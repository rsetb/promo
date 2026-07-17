/**
 * Verifica a migração de ponta a ponta num banco descartável.
 *
 * Roda o mesmo SQL de drizzle/, a mesma abertura de conexão (src/db/open.ts,
 * com os PRAGMAs de produção) e o mesmo scripts/lib/import-core.ts, com os
 * dados reais de data/catalog-export.json — e então confere o resultado e as
 * restrições do schema.
 *
 * Diferente do Postgres, aqui o motor do teste é literalmente o mesmo de
 * produção: SQLite.
 *
 * Uso: npm run db:verify
 */
import { readFileSync, readdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/db/open';
import { importData } from './lib/import-core';
import type { CatalogExport } from './lib/transform';

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++;
    console.log(`  FALHOU  ${label}\n          esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
  } else {
    console.log(`  ok      ${label} = ${JSON.stringify(actual)}`);
  }
}

function main() {
  const dir = mkdtempSync(join(tmpdir(), 'promo-verify-'));
  const dbPath = join(dir, 'verify.db');
  const db = openDatabase(dbPath);

  /** Confirma que o banco REJEITA uma operação inválida. */
  const checkRejects = (label: string, sql: string) => {
    checks++;
    try {
      db.exec(sql);
      failures++;
      console.log(`  FALHOU  ${label} — o banco ACEITOU o que deveria recusar`);
    } catch {
      console.log(`  ok      ${label} — recusado pelo banco`);
    }
  };

  console.log('\n== PRAGMAs (a garantia de FK depende deles) ==');
  check('foreign_keys ligado', db.pragma('foreign_keys', { simple: true }), 1);
  check('journal_mode', db.pragma('journal_mode', { simple: true }), 'wal');

  console.log('\n== migration ==');
  for (const file of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join('drizzle', file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) db.exec(statement);
    }
    console.log(`  aplicada: ${file}`);
  }

  console.log('\n== import (dados reais do catálogo) ==');
  const data: CatalogExport = JSON.parse(readFileSync('data/catalog-export.json', 'utf8'));
  const query = (sql: string, params: unknown[] = []) => {
    const statement = db.prepare(sql);
    return statement.reader
      ? { rows: statement.all(...(params as [])) }
      : (statement.run(...(params as [])), { rows: [] });
  };
  const stats = importData(query, data);
  console.log(`  origem:  ${data.products.length} produtos, ${data.categories.length} categorias`);
  console.log(`  destino: ${stats.products} produtos, ${stats.categories} categorias`);
  console.log(`  duplicados resolvidos: ${stats.decisions.length}`);

  const one = <T>(sql: string): T => db.prepare(sql).get() as T;

  console.log('\n== conteúdo ==');
  check('produtos importados', one<{ n: number }>('SELECT count(*) AS n FROM products').n, 285);
  check('categorias importadas', one<{ n: number }>('SELECT count(*) AS n FROM categories').n, 22);
  check(
    'categorias duplicadas',
    one<{ n: number }>('SELECT count(*) - count(DISTINCT name) AS n FROM categories').n,
    0
  );
  check(
    'produtos com nome duplicado',
    one<{ n: number }>('SELECT count(*) - count(DISTINCT upper(name)) AS n FROM products').n,
    0
  );
  check(
    'nomes com espaco sobrando',
    one<{ n: number }>('SELECT count(*) AS n FROM products WHERE name <> trim(name)').n,
    0
  );
  check(
    'categoria com typo removida',
    one<{ n: number }>("SELECT count(*) AS n FROM categories WHERE name = 'CIGARRO NACIONAL'").n,
    0
  );
  // 71 dos 294 originais não tinham preço (27 null + 44 zeros). Um deles, o
  // BALLENA COCO do seed, tinha preço 0 e foi descartado na deduplicação em
  // favor da versão de R$ 115,90 — daí 70, e não 71.
  check(
    'produtos sem preco (NULL = "Consulte")',
    one<{ n: number }>('SELECT count(*) AS n FROM products WHERE price_cents IS NULL').n,
    70
  );
  check(
    'precos zerados remanescentes',
    one<{ n: number }>('SELECT count(*) AS n FROM products WHERE price_cents = 0').n,
    0
  );

  console.log('\n== preco em centavos: inteiro e exato ==');
  check(
    'nenhum preco fracionario (prova de que nao virou float)',
    one<{ n: number }>('SELECT count(*) AS n FROM products WHERE price_cents IS NOT NULL AND price_cents <> cast(price_cents AS INTEGER)').n,
    0
  );
  check(
    'tipo da coluna no SQLite e integer',
    one<{ t: string }>("SELECT typeof(price_cents) AS t FROM products WHERE price_cents IS NOT NULL LIMIT 1").t,
    'integer'
  );

  console.log('\n== duplicados: venceu a versao editada no site ==');
  for (const [name, expected] of [
    ['DUNHILL DOUBLE', 14250],
    ['KENT PRATA', 11775],
    ['FUMO TREVO', 9030],
    ['G BRANCO', 2750],
    ['ROTHMANS GLOBAL AZUL', 7520],
    ['BALLENA COCO', 11590],
  ] as const) {
    const row = one<{ price_cents: number | null }>(
      `SELECT price_cents FROM products WHERE name = '${name}'`
    );
    check(`${name} (centavos)`, row?.price_cents, expected);
  }
  check(
    'G VERMELHO (sem preco, conforme decidido)',
    one<{ price_cents: number | null }>(`SELECT price_cents FROM products WHERE name = 'G VERMELHO'`)?.price_cents,
    null
  );

  console.log('\n== integridade referencial ==');
  check(
    'produtos orfaos (sem categoria valida)',
    one<{ n: number }>(
      'SELECT count(*) AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE c.id IS NULL'
    ).n,
    0
  );
  check(
    'PANDORA BRANCO caiu na categoria corrigida',
    one<{ name: string }>(
      "SELECT c.name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.name = 'PANDORA BRANCO'"
    ).name,
    'CIGARROS NACIONAL'
  );

  console.log('\n== o banco recusa dados invalidos ==');
  const catId = one<{ id: number }>('SELECT id FROM categories LIMIT 1').id;
  checkRejects('categoria duplicada', `INSERT INTO categories (name) VALUES ('VODKAS')`);
  checkRejects('preco negativo', `INSERT INTO products (name, category_id, price_cents) VALUES ('X', ${catId}, -1)`);
  checkRejects('nome vazio', `INSERT INTO products (name, category_id) VALUES ('   ', ${catId})`);
  checkRejects('categoria inexistente', `INSERT INTO products (name, category_id) VALUES ('X', 999999)`);
  checkRejects('excluir categoria com produtos', `DELETE FROM categories WHERE id = ${catId}`);
  checkRejects(
    'segunda linha em site_info',
    `INSERT INTO site_info (id, site_name, hero_title_1, hero_title_2, hero_slogan, hero_location, hero_phone, hero_phone_display, hero_location_2, hero_phone_2, hero_phone_display_2) VALUES (2, 'x','x','x','x','x','x','x','x','x','x')`
  );

  console.log('\n== site_info ==');
  check(
    'telefone do WhatsApp preservado',
    one<{ hero_phone: string }>('SELECT hero_phone FROM site_info WHERE id = 1').hero_phone,
    '5585994125603'
  );

  db.close();
  rmSync(dir, { recursive: true, force: true });

  console.log(`\n${'-'.repeat(46)}`);
  if (failures) {
    console.log(`${failures} de ${checks} verificacoes FALHARAM`);
    process.exit(1);
  }
  console.log(`todas as ${checks} verificacoes passaram`);
}

main();

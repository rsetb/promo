/**
 * Verifica a migração de ponta a ponta contra um Postgres real rodando em WASM
 * (PGlite) — sem precisar de Docker ou de um servidor.
 *
 * Executa o mesmo SQL de drizzle/ e o mesmo scripts/lib/import-core.ts que a
 * migração de produção usa, com os dados reais exportados do Firestore, e então
 * confere o resultado e as restrições do schema.
 *
 * Uso: npx tsx scripts/verify-migration.ts
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { importData } from './lib/import-core';
import type { FirestoreExport } from './lib/transform';

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.log(`  FALHOU  ${label}\n          esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
  } else {
    console.log(`  ok      ${label} = ${JSON.stringify(actual)}`);
  }
}

/** Confirma que o banco REJEITA uma operação inválida. */
async function checkRejects(db: PGlite, label: string, sql: string, params: unknown[] = []) {
  checks++;
  try {
    await db.query(sql, params);
    failures++;
    console.log(`  FALHOU  ${label} — o banco ACEITOU o que deveria recusar`);
  } catch {
    console.log(`  ok      ${label} — recusado pelo banco`);
  }
}

async function main() {
  const db = new PGlite();

  console.log('\n== migration ==');
  const dir = 'drizzle';
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8');
    for (const stmt of sql.split('--> statement-breakpoint')) {
      if (stmt.trim()) await db.exec(stmt);
    }
    console.log(`  aplicada: ${file}`);
  }

  console.log('\n== import (dados reais do Firestore) ==');
  const data: FirestoreExport = JSON.parse(readFileSync('data/firestore-export.json', 'utf8'));
  const stats = await importData((sql, params) => db.query(sql, params as any[]) as any, data);
  console.log(`  origem:  ${data.products.length} produtos, ${data.categories.length} categorias`);
  console.log(`  destino: ${stats.products} produtos, ${stats.categories} categorias`);
  console.log(`  duplicados resolvidos: ${stats.decisions.length}`);

  const one = async <T>(sql: string): Promise<T> => (await db.query<T>(sql)).rows[0];

  console.log('\n== conteúdo ==');
  check('produtos importados', (await one<{ n: number }>('SELECT count(*)::int AS n FROM products')).n, 285);
  check('categorias importadas', (await one<{ n: number }>('SELECT count(*)::int AS n FROM categories')).n, 22);
  check(
    'categorias duplicadas (80 -> unicas)',
    (await one<{ n: number }>('SELECT (count(*) - count(DISTINCT name))::int AS n FROM categories')).n,
    0
  );
  check(
    'produtos com nome duplicado',
    (await one<{ n: number }>('SELECT (count(*) - count(DISTINCT upper(name)))::int AS n FROM products')).n,
    0
  );
  check(
    'nomes com espaco sobrando',
    (await one<{ n: number }>("SELECT count(*)::int AS n FROM products WHERE name <> btrim(name)")).n,
    0
  );
  check(
    'categoria com typo removida',
    (await one<{ n: number }>("SELECT count(*)::int AS n FROM categories WHERE name = 'CIGARRO NACIONAL'")).n,
    0
  );
  // 71 dos 294 originais não tinham preço (27 null + 44 zeros). Um deles, o
  // BALLENA COCO do seed, tinha preço 0 e foi descartado na deduplicação em
  // favor da versão de R$ 115,90 — daí 70, e não 71.
  check(
    'produtos sem preco (NULL = "Consulte")',
    (await one<{ n: number }>('SELECT count(*)::int AS n FROM products WHERE price IS NULL')).n,
    70
  );
  check(
    'precos zerados remanescentes',
    (await one<{ n: number }>('SELECT count(*)::int AS n FROM products WHERE price = 0')).n,
    0
  );

  console.log('\n== duplicados: venceu a versao editada no site ==');
  for (const [name, expected] of [
    ['DUNHILL DOUBLE', '142.50'],
    ['KENT PRATA', '117.75'],
    ['FUMO TREVO', '90.30'],
    ['G BRANCO', '27.50'],
    ['ROTHMANS GLOBAL AZUL', '75.20'],
    ['BALLENA COCO', '115.90'],
  ] as const) {
    const row = await one<{ price: string | null }>(
      `SELECT price::text AS price FROM products WHERE name = '${name}'`
    );
    check(name, row?.price, expected);
  }
  const gv = await one<{ price: string | null }>(`SELECT price::text AS price FROM products WHERE name = 'G VERMELHO'`);
  check('G VERMELHO (sem preco, conforme decidido)', gv?.price, null);

  console.log('\n== integridade referencial ==');
  check(
    'produtos orfaos (sem categoria valida)',
    (await one<{ n: number }>(
      'SELECT count(*)::int AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE c.id IS NULL'
    )).n,
    0
  );
  check(
    'PANDORA BRANCO caiu na categoria corrigida',
    (await one<{ name: string }>(
      "SELECT c.name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.name = 'PANDORA BRANCO'"
    )).name,
    'CIGARROS NACIONAL'
  );

  console.log('\n== o banco recusa dados invalidos ==');
  const catId = (await one<{ id: number }>('SELECT id FROM categories LIMIT 1')).id;
  await checkRejects(db, 'categoria duplicada', `INSERT INTO categories (name) VALUES ('VODKAS')`);
  await checkRejects(db, 'preco negativo', `INSERT INTO products (name, category_id, price) VALUES ('X', ${catId}, -1)`);
  await checkRejects(db, 'nome vazio', `INSERT INTO products (name, category_id) VALUES ('   ', ${catId})`);
  await checkRejects(db, 'categoria inexistente', `INSERT INTO products (name, category_id) VALUES ('X', 999999)`);
  await checkRejects(db, 'excluir categoria com produtos', `DELETE FROM categories WHERE id = ${catId}`);
  await checkRejects(db, 'segunda linha em site_info', `INSERT INTO site_info (id, site_name, hero_title_1, hero_title_2, hero_slogan, hero_location, hero_phone, hero_phone_display, hero_location_2, hero_phone_2, hero_phone_display_2) VALUES (2, 'x','x','x','x','x','x','x','x','x','x')`);

  console.log('\n== site_info ==');
  check(
    'telefone do WhatsApp preservado',
    (await one<{ hero_phone: string }>('SELECT hero_phone FROM site_info WHERE id = 1')).hero_phone,
    '5585994125603'
  );

  await db.close();

  console.log(`\n${'-'.repeat(46)}`);
  if (failures) {
    console.log(`${failures} de ${checks} verificacoes FALHARAM`);
    process.exit(1);
  }
  console.log(`todas as ${checks} verificacoes passaram`);
}

main().catch((err) => {
  console.error('\nErro na verificacao:', err);
  process.exit(1);
});

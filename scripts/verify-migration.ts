/**
 * Verifica a preparação do banco de ponta a ponta, num arquivo descartável.
 *
 * Exercita exatamente o que roda em produção:
 *   - o mesmo SQL de drizzle/
 *   - as MESMAS funções de scripts/migrate.mjs que o container executa no start
 *   - a transformação real de scripts/lib/transform.ts, com os dados reais
 *
 * Uso: npm run db:verify
 */
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase as openFromApp } from '../src/db/open';
import { openDatabase as openFromContainer, applyMigrations, seedIfEmpty } from './migrate.mjs';
import { buildCategories, buildProducts, type CatalogExport } from './lib/transform';
import { DEFAULT_SITE_INFO } from './lib/site-info';

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

  // ---------------------------------------------------------------- PRAGMAs
  // O app (TypeScript) e o container (migrate.mjs) abrem o banco por caminhos
  // diferentes. Se divergirem, a integridade some em silêncio em um dos dois.
  console.log('\n== as duas aberturas de banco concordam? ==');
  const PRAGMAS = ['foreign_keys', 'journal_mode', 'busy_timeout', 'synchronous'] as const;
  const appDb = openFromApp(join(dir, 'app-path.db'));
  const containerDb = openFromContainer(join(dir, 'container-path.db'));
  for (const pragma of PRAGMAS) {
    const fromApp = appDb.pragma(pragma, { simple: true });
    const fromContainer = containerDb.pragma(pragma, { simple: true });
    check(`${pragma} (app=${fromApp}, container=${fromContainer})`, fromApp, fromContainer);
  }
  check('foreign_keys realmente ligado', appDb.pragma('foreign_keys', { simple: true }), 1);
  appDb.close();
  containerDb.close();

  // ------------------------------------------------------------------- seed
  console.log('\n== build do seed (transformação real) ==');
  const data: CatalogExport = JSON.parse(readFileSync('data/catalog-export.json', 'utf8'));
  const categories = buildCategories(data);
  const { products, decisions } = buildProducts(data);
  const seedPath = join(dir, 'seed.json');
  writeFileSync(
    seedPath,
    JSON.stringify({
      categories,
      products,
      siteInfo: { ...DEFAULT_SITE_INFO, ...(data.siteInfo ?? {}) },
    })
  );
  console.log(`  origem: ${data.products.length} produtos, ${data.categories.length} categorias`);
  console.log(`  seed:   ${products.length} produtos, ${categories.length} categorias`);
  console.log(`  duplicados resolvidos: ${decisions.length}`);

  // ------------------------------------------- migrate + seed (como no start)
  console.log('\n== migrate + seed (mesmo codigo do container) ==');
  const dbPath = join(dir, 'verify.db');
  const db = openFromContainer(dbPath);
  applyMigrations(db, './drizzle');
  const first = seedIfEmpty(db, seedPath);
  check('primeiro boot carregou o catalogo', first.seeded, true);

  // Um redeploy NAO pode reverter precos editados no site.
  const second = seedIfEmpty(db, seedPath);
  check('segundo boot NAO reseeda (protege edicoes)', second.seeded, false);

  const one = <T>(sql: string): T => db.prepare(sql).get() as T;

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

  console.log('\n== conteudo ==');
  check('produtos importados', one<{ n: number }>('SELECT count(*) AS n FROM products').n, 285);
  check('categorias importadas', one<{ n: number }>('SELECT count(*) AS n FROM categories').n, 22);
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
    'produtos sem preco nenhum (= "Consulte")',
    one<{ n: number }>(
      'SELECT count(*) AS n FROM products WHERE price_pack_cents IS NULL AND price_unit_cents IS NULL'
    ).n,
    70
  );
  check(
    'precos zerados remanescentes',
    one<{ n: number }>(
      'SELECT count(*) AS n FROM products WHERE price_pack_cents = 0 OR price_unit_cents = 0'
    ).n,
    0
  );

  console.log('\n== fardo x unidade ==');
  check(
    'com preco de fardo',
    one<{ n: number }>('SELECT count(*) AS n FROM products WHERE price_pack_cents IS NOT NULL').n,
    166
  );
  check(
    'com preco de unidade',
    one<{ n: number }>('SELECT count(*) AS n FROM products WHERE price_unit_cents IS NOT NULL').n,
    49
  );
  // Nenhum produto do catalogo antigo tinha os dois: o export trazia um preco
  // so. Se aparecerem dois, a regra de separacao duplicou em vez de mover.
  check(
    'com os DOIS precos (o export so tinha um)',
    one<{ n: number }>(
      'SELECT count(*) AS n FROM products WHERE price_pack_cents IS NOT NULL AND price_unit_cents IS NOT NULL'
    ).n,
    0
  );
  check(
    'destilado com preco de fardo (regra furou)',
    one<{ n: number }>(
      `SELECT count(*) AS n FROM products p JOIN categories c ON c.id = p.category_id
       WHERE c.name IN ('VODKAS','WHISKYS','GIN','LICORES','VINHOS','DESTILADOS')
         AND p.price_pack_cents IS NOT NULL`
    ).n,
    0
  );
  check(
    'nao-destilado com preco de unidade (regra furou)',
    one<{ n: number }>(
      `SELECT count(*) AS n FROM products p JOIN categories c ON c.id = p.category_id
       WHERE c.name NOT IN ('VODKAS','WHISKYS','GIN','LICORES','VINHOS','DESTILADOS')
         AND p.price_unit_cents IS NOT NULL`
    ).n,
    0
  );

  console.log('\n== preco em centavos: inteiro e exato ==');
  check(
    'tipo da coluna no SQLite e integer',
    one<{ t: string }>(
      'SELECT typeof(price_pack_cents) AS t FROM products WHERE price_pack_cents IS NOT NULL LIMIT 1'
    ).t,
    'integer'
  );

  console.log('\n== duplicados: venceu a versao editada no site ==');
  // A coluna esperada muda com a categoria: BALLENA COCO e LICORES (unidade),
  // os cigarros sao fardo.
  for (const [name, coluna, expected] of [
    ['DUNHILL DOUBLE', 'price_pack_cents', 14250],
    ['KENT PRATA', 'price_pack_cents', 11775],
    ['FUMO TREVO', 'price_pack_cents', 9030],
    ['G BRANCO', 'price_pack_cents', 2750],
    ['ROTHMANS GLOBAL AZUL', 'price_pack_cents', 7520],
    ['BALLENA COCO', 'price_unit_cents', 11590],
  ] as const) {
    check(
      `${name} (${coluna === 'price_pack_cents' ? 'fardo' : 'unidade'})`,
      (one<Record<string, number | null>>(`SELECT ${coluna} FROM products WHERE name = '${name}'`))?.[coluna],
      expected
    );
  }
  check(
    'G VERMELHO (sem preco, conforme decidido)',
    one<{ n: number }>(
      `SELECT count(*) AS n FROM products WHERE name = 'G VERMELHO'
       AND price_pack_cents IS NULL AND price_unit_cents IS NULL`
    ).n,
    1
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
  // Os dois CHECKs, separados: um insert numa coluna que nem existe também
  // "falha", e passaria o teste pelo motivo errado.
  checkRejects(
    'preco de fardo negativo',
    `INSERT INTO products (name, category_id, price_pack_cents) VALUES ('X', ${catId}, -1)`
  );
  checkRejects(
    'preco de unidade negativo',
    `INSERT INTO products (name, category_id, price_unit_cents) VALUES ('X', ${catId}, -1)`
  );
  checkRejects(
    'preco de caixa negativo',
    `INSERT INTO products (name, category_id, price_box_cents) VALUES ('X', ${catId}, -1)`
  );
  // "Fardo 0un" e sempre erro de digitacao, nao um estado valido.
  checkRejects(
    'fardo com 0 unidades',
    `INSERT INTO products (name, category_id, pack_qty) VALUES ('X', ${catId}, 0)`
  );
  checkRejects(
    'caixa com quantidade negativa',
    `INSERT INTO products (name, category_id, box_qty) VALUES ('X', ${catId}, -3)`
  );
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

/**
 * Prepara o banco: aplica migrations e, se estiver vazio, carrega o catálogo.
 * Roda no start do container, antes do servidor subir.
 *
 * É JavaScript puro (.mjs) de propósito: a imagem de produção não tem tsx nem
 * os fontes TypeScript — só isto, o drizzle/ e o data/seed.json.
 *
 * As funções são exportadas para que scripts/verify-migration.ts exercite este
 * mesmo código, e não uma cópia parecida.
 */
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Abre o banco com os PRAGMAs. Espelha src/db/open.ts — que é TypeScript e não
 * existe na imagem de produção. Os dois precisam concordar; o db:verify checa.
 */
export function openDatabase(path) {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');
  return sqlite;
}

export function applyMigrations(db, folder = './drizzle') {
  migrate(drizzle(db), { migrationsFolder: folder });
}

/**
 * Carrega o catálogo se o banco estiver vazio.
 *
 * Nunca sobrescreve dados existentes: uma vez que o catálogo está no ar e sendo
 * editado, o seed não pode ter voz. Por isso a checagem de `count > 0` e não um
 * simples "insere se não existir" — um redeploy não pode reverter preços.
 */
export function seedIfEmpty(db, seedPath = './data/seed.json') {
  const { n } = db.prepare('SELECT count(*) AS n FROM products').get();
  if (n > 0) return { seeded: false, products: n };

  if (!existsSync(seedPath)) return { seeded: false, products: 0, missingSeed: true };

  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));

  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  const findCategory = db.prepare('SELECT id FROM categories WHERE name = ?');
  const insertProduct = db.prepare(
    'INSERT INTO products (name, description, price_cents, category_id) VALUES (?, ?, ?, ?)'
  );
  const insertSiteInfo = db.prepare(`
    INSERT INTO site_info (
      id, site_name, hero_title_1, hero_title_2, hero_slogan,
      hero_location, hero_phone, hero_phone_display,
      hero_location_2, hero_phone_2, hero_phone_display_2
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO NOTHING
  `);

  const run = db.transaction(() => {
    const ids = new Map();
    for (const name of seed.categories) {
      insertCategory.run(name);
      ids.set(name, findCategory.get(name).id);
    }

    for (const p of seed.products) {
      const categoryId = ids.get(p.category);
      if (!categoryId) throw new Error(`Categoria não encontrada: ${p.category}`);
      insertProduct.run(p.name, p.description, p.priceCents, categoryId);
    }

    const s = seed.siteInfo;
    insertSiteInfo.run(
      s.siteName,
      s.heroTitle1,
      s.heroTitle2,
      s.heroSlogan,
      s.heroLocation,
      s.heroPhone,
      s.heroPhoneDisplay,
      s.heroLocation2,
      s.heroPhone2,
      s.heroPhoneDisplay2
    );
  });

  run();
  return { seeded: true, products: seed.products.length, categories: seed.categories.length };
}

// Executado direto (container ou `npm run db:migrate`), não importado.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migrate.mjs')) {
  const path = process.env.DATABASE_PATH ?? './data/app.db';
  try {
    const db = openDatabase(path);
    applyMigrations(db);
    console.log(`migrations aplicadas em ${path}`);

    const result = seedIfEmpty(db);
    if (result.seeded) {
      console.log(`catálogo carregado: ${result.products} produtos, ${result.categories} categorias`);
    } else if (result.missingSeed) {
      console.log('banco vazio e data/seed.json ausente — nenhum dado carregado.');
    } else {
      console.log(`banco já tem ${result.products} produtos — seed ignorado.`);
    }

    db.close();
  } catch (error) {
    console.error('falha ao preparar o banco:', error.message);
    process.exit(1);
  }
}

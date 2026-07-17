/**
 * Importa data/catalog-export.json para o banco SQLite em DATABASE_PATH.
 *
 * Uso:
 *   npm run db:import           # aborta se já houver dados
 *   npm run db:import -- --force  # apaga e reimporta
 *
 * Roda dentro de uma transação: ou tudo entra, ou nada muda.
 * A lógica fica em scripts/lib/import-core.ts, verificada por scripts/verify-migration.ts.
 */
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openDatabase, getDatabasePath } from '../src/db/open';
import { importData } from './lib/import-core';
import type { CatalogExport } from './lib/transform';

config({ path: '.env' });

function main() {
  const force = process.argv.includes('--force');
  const path = getDatabasePath();

  const data: CatalogExport = JSON.parse(readFileSync('data/catalog-export.json', 'utf8'));
  console.log(`origem:  ${data.products.length} produtos, ${data.categories.length} categorias`);
  console.log(`destino: ${path}`);

  const db = openDatabase(path);

  // Mesma migração que roda no container: cria o schema se ainda não existir.
  migrate(drizzle(db), { migrationsFolder: './drizzle' });

  const existing = db.prepare('SELECT count(*) AS n FROM products').get() as { n: number };
  if (existing.n > 0 && !force) {
    console.error(`\nA tabela products já tem ${existing.n} registros. Use --force para reimportar.`);
    process.exit(1);
  }

  const query = (sql: string, params: unknown[] = []) => {
    const statement = db.prepare(sql);
    return statement.reader ? { rows: statement.all(...(params as [])) } : (statement.run(...(params as [])), { rows: [] });
  };

  const run = db.transaction(() => {
    if (force) {
      db.exec('DELETE FROM products');
      db.exec('DELETE FROM categories');
      db.exec("DELETE FROM sqlite_sequence WHERE name IN ('products', 'categories')");
    }
    return importData(query, data);
  });

  const stats = run();

  console.log(`\nimportado: ${stats.products} produtos, ${stats.categories} categorias`);
  if (stats.decisions.length) {
    console.log('\nduplicados resolvidos (mantida a versão editada no site):');
    for (const d of stats.decisions) {
      const dropped = d.dropped.map((p) => `${p.id}=${p.price ?? 'sem preço'}`).join(', ');
      console.log(`  ${d.name}: mantido ${d.kept.id}=${d.kept.price ?? 'sem preço'} | descartado ${dropped}`);
    }
  }

  db.close();
  console.log('\nimport concluído.');
}

main();

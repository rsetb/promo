/**
 * Importa data/catalog-export.json para o Postgres apontado por DATABASE_URL.
 *
 * Uso:
 *   npx tsx scripts/import-to-postgres.ts          # aborta se já houver dados
 *   npx tsx scripts/import-to-postgres.ts --force  # apaga e reimporta
 *
 * Roda dentro de uma transação: ou tudo entra, ou nada muda.
 * A lógica fica em scripts/lib/import-core.ts, verificada por scripts/verify-migration.ts.
 */
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { importData } from './lib/import-core';
import type { CatalogExport } from './lib/transform';

config({ path: '.env' });

async function main() {
  const force = process.argv.includes('--force');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não definida. Copie .env.example para .env.');
  }

  const data: CatalogExport = JSON.parse(readFileSync('data/catalog-export.json', 'utf8'));
  console.log(`origem: ${data.products.length} produtos, ${data.categories.length} categorias`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  const client = await pool.connect();

  try {
    const { rows } = await client.query('SELECT count(*)::int AS n FROM products');
    if (rows[0].n > 0 && !force) {
      throw new Error(
        `A tabela products já tem ${rows[0].n} registros. Use --force para apagar e reimportar.`
      );
    }

    await client.query('BEGIN');
    if (force) {
      await client.query('TRUNCATE products, categories RESTART IDENTITY CASCADE');
    }

    const stats = await importData((sql, params) => client.query(sql, params as any[]), data);

    await client.query('COMMIT');

    console.log(`destino: ${stats.products} produtos, ${stats.categories} categorias`);
    if (stats.decisions.length) {
      console.log('\nduplicados resolvidos (mantida a versão editada no site):');
      for (const d of stats.decisions) {
        const dropped = d.dropped.map((p) => `${p.id}=${p.price ?? 'sem preço'}`).join(', ');
        console.log(
          `  ${d.name}: mantido ${d.kept.id}=${d.kept.price ?? 'sem preço'} | descartado ${dropped}`
        );
      }
    }
    console.log('\nimport concluído.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\nFalha no import:', err.message);
  process.exit(1);
});

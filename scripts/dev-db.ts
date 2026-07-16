/**
 * Banco de desenvolvimento local, sem instalar Postgres nem Docker.
 *
 * Sobe um PGlite (Postgres compilado para WASM) falando o protocolo real do
 * Postgres numa porta TCP, aplica as migrations e importa o catálogo de
 * data/catalog-export.json. O app conecta nele como em qualquer Postgres.
 *
 * Uso:
 *   npm run dev:db          # deixe rodando neste terminal
 *   npm run dev             # em outro terminal
 *
 * Os dados ficam em data/dev-db/ e sobrevivem a reinícios. NÃO é para produção:
 * em produção o app usa o Postgres da VPS via DATABASE_URL.
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { importData } from './lib/import-core';
import type { CatalogExport } from './lib/transform';

// Porta alta: no Windows a 5432 costuma cair numa faixa reservada e o listen
// falha com EACCES mesmo sem nenhum Postgres instalado.
const PORT = Number(process.env.DEV_DB_PORT ?? 54329);
const DATA_DIR = 'data/dev-db';

async function main() {
  const isFirstRun = !existsSync(DATA_DIR);
  const db = await PGlite.create({ dataDir: DATA_DIR });

  if (isFirstRun) {
    console.log('primeira execução: criando o banco...');

    for (const file of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) {
      const sql = readFileSync(join('drizzle', file), 'utf8');
      for (const statement of sql.split('--> statement-breakpoint')) {
        if (statement.trim()) await db.exec(statement);
      }
      console.log(`  migration aplicada: ${file}`);
    }

    const exportPath = 'data/catalog-export.json';
    if (existsSync(exportPath)) {
      const data: CatalogExport = JSON.parse(readFileSync(exportPath, 'utf8'));
      const stats = await importData((sql, params) => db.query(sql, params as any[]) as any, data);
      console.log(`  importados: ${stats.products} produtos, ${stats.categories} categorias`);
    } else {
      console.log('  (data/catalog-export.json não encontrado — banco vazio)');
    }
  }

  const server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1' });
  await server.start();

  const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM products');
  console.log(`\nPostgres de desenvolvimento em 127.0.0.1:${PORT} — ${rows[0].n} produtos`);
  console.log(`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`);
  console.log('\nCtrl+C para parar.');

  const shutdown = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Falha ao subir o banco de desenvolvimento:', err);
  process.exit(1);
});

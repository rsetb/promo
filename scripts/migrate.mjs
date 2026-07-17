/**
 * Aplica as migrations pendentes e sai. Roda no start do container, antes do
 * servidor subir, e também via `npm run db:migrate`.
 *
 * É JavaScript puro (.mjs) de propósito: a imagem de produção não tem tsx nem
 * drizzle-kit, então precisa ser executável direto pelo node.
 *
 * Só faz DDL. Os PRAGMAs de runtime que importam para a integridade
 * (foreign_keys) são aplicados por quem usa o banco — ver src/db/open.ts.
 * O journal_mode = WAL, esse sim, fica gravado no arquivo.
 */
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const path = process.env.DATABASE_PATH ?? './data/app.db';

try {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');

  migrate(drizzle(sqlite), { migrationsFolder: './drizzle' });
  sqlite.close();

  console.log(`migrations aplicadas em ${path}`);
} catch (error) {
  console.error('falha nas migrations:', error.message);
  process.exit(1);
}

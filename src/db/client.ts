import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type Database from 'better-sqlite3';
import { getDatabasePath, openDatabase } from './open';
import * as schema from './schema';

/**
 * A conexão Drizzle.
 *
 * Não importa 'server-only', igual a ./open.ts e src/lib/uploads.ts: os scripts
 * de verificação precisam exercitar o mesmo código fora do Next. Quem quer a
 * proteção importa de '@/db', que é este módulo + server-only.
 *
 * Importar isto num client component quebra o build de qualquer forma — o
 * better-sqlite3 é binário nativo e não existe no navegador.
 */

const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database;
  db?: BetterSQLite3Database<typeof schema>;
};

function createDb(): BetterSQLite3Database<typeof schema> {
  const sqlite = globalForDb.sqlite ?? openDatabase(getDatabasePath());
  // O hot reload do Next recria os módulos a cada alteração; sem guardar a
  // conexão no globalThis, o dev server abre um handle novo por reload.
  if (process.env.NODE_ENV !== 'production') globalForDb.sqlite = sqlite;
  return drizzle(sqlite, { schema });
}

function getDb(): BetterSQLite3Database<typeof schema> {
  if (!globalForDb.db) globalForDb.db = createDb();
  return globalForDb.db;
}

/**
 * Conexão preguiçosa: só abre o arquivo no primeiro uso real.
 *
 * `next build` importa os módulos de rota para analisá-las. Abrir o banco no
 * topo do módulo criaria um arquivo vazio durante a build da imagem Docker —
 * numa camada que é descartada, mascarando erro de configuração.
 */
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export { schema, getDatabasePath };

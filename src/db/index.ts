import 'server-only';

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * O Pool é guardado no globalThis porque o hot reload do Next recria os módulos
 * a cada alteração; sem isso o dev server abre uma conexão nova por reload até
 * estourar o limite do Postgres.
 */
const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: NodePgDatabase<typeof schema>;
};

function createDb(): NodePgDatabase<typeof schema> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não definida. Copie .env.example para .env e preencha.');
  }

  const pool =
    globalForDb.pool ??
    new Pool({
      connectionString: process.env.DATABASE_URL,
      // O Postgres de produção aguenta o pool inteiro. O banco local do
      // `npm run dev:db` (PGlite) atende uma conexão por vez, então lá o .env
      // define DB_POOL_MAX=1.
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      // EasyPanel liga o app ao Postgres pela rede interna do Docker, onde não
      // há TLS. Em qualquer host externo, exija SSL.
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });

  if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

  return drizzle(pool, { schema });
}

function getDb(): NodePgDatabase<typeof schema> {
  if (!globalForDb.db) globalForDb.db = createDb();
  return globalForDb.db;
}

/**
 * Conexão preguiçosa: só abre no primeiro uso real.
 *
 * `next build` importa os módulos de rota para analisá-las. Se a conexão fosse
 * criada no topo do módulo, o build exigiria um Postgres acessível — o que
 * quebraria a build da imagem Docker, onde o banco não existe ainda.
 */
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export { schema };

/**
 * Aplica as migrations pendentes e sai. Roda no start do container, antes do
 * servidor subir.
 *
 * É JavaScript puro (.mjs) de propósito: a imagem de produção não tem tsx nem
 * drizzle-kit, então precisa ser executável direto pelo node.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  console.log('migrations aplicadas.');
} catch (error) {
  console.error('falha nas migrations:', error.message);
  process.exit(1);
} finally {
  await pool.end();
}

/** Checagem de conectividade e de compatibilidade do banco em DATABASE_URL. */
import pg from 'pg';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres';

const DRIZZLE_QUERY = `select "products"."id", "products"."name", "products"."description", "products"."price", "products"."category_id", "categories"."name" from "products" inner join "categories" on "products"."category_id" = "categories"."id" order by "products"."name" asc`;

async function attempt(label, fn) {
  try {
    const result = await fn();
    console.log(`ok      ${label}: ${result}`);
    return true;
  } catch (error) {
    console.log(`FALHOU  ${label}: ${error.message}`);
    return false;
  }
}

const client = new pg.Client({ connectionString: url });
await client.connect();

await attempt('query simples', async () => {
  const r = await client.query('SELECT count(*)::int AS n FROM products');
  return `${r.rows[0].n} produtos`;
});

await attempt('query com parametro ($1)', async () => {
  const r = await client.query('SELECT count(*)::int AS n FROM products WHERE price > $1', [50]);
  return `${r.rows[0].n} acima de 50`;
});

await attempt('query exata gerada pelo drizzle (join)', async () => {
  const r = await client.query(DRIZZLE_QUERY);
  return `${r.rows.length} linhas, 1a = ${r.rows[0].name}`;
});

await client.end();

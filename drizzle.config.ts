import type { Config } from 'drizzle-kit';
import { config } from 'dotenv';

config({ path: '.env' });

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? './data/app.db',
  },
  strict: true,
  verbose: true,
} satisfies Config;

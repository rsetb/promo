/**
 * Sobe o app do jeito que ele roda em produção, para os testes de navegador.
 *
 * Usa o server.js do build standalone — o mesmo que o container executa — em
 * vez de `next start`, que o Next avisa não funcionar com output: 'standalone'.
 *
 * Recria o banco do zero a cada execução: os testes escrevem (editam preço,
 * criam categoria), e um banco herdado da rodada anterior faria um teste falhar
 * por causa do outro, sem relação com o código.
 */
import { spawn } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const DB = resolve(ROOT, 'data/e2e.db');
const UPLOADS = resolve(ROOT, 'data/e2e-uploads');
const STANDALONE = resolve(ROOT, '.next/standalone');

for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) rmSync(f, { force: true });
rmSync(UPLOADS, { recursive: true, force: true });
mkdirSync(UPLOADS, { recursive: true });

if (!existsSync(STANDALONE)) {
  console.error('Rode `npm run build` antes: .next/standalone não existe.');
  process.exit(1);
}

// O build standalone não copia estes: o `next start` normal os serve do lugar
// original, mas o server.js espera encontrá-los ao lado dele.
cpSync(resolve(ROOT, '.next/static'), resolve(STANDALONE, '.next/static'), { recursive: true });
cpSync(resolve(ROOT, 'public'), resolve(STANDALONE, 'public'), { recursive: true });

const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: '3100',
  HOSTNAME: '127.0.0.1',
  DATABASE_PATH: DB,
  UPLOADS_PATH: UPLOADS,
  ADMIN_PASSWORD: 'senha-de-teste-e2e',
  SESSION_SECRET: 'segredo-e2e-com-mais-de-32-caracteres-aqui',
};

// Migrations + catálogo, no banco recém-criado.
const migrate = spawn(process.execPath, ['scripts/migrate.mjs'], { env, stdio: 'inherit' });

migrate.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const server = spawn(process.execPath, [resolve(STANDALONE, 'server.js')], {
    env,
    stdio: 'inherit',
    cwd: STANDALONE,
  });
  server.on('exit', (c) => process.exit(c ?? 0));
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));
});

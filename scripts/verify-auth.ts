/**
 * Testa a senha e a sessão contra um banco descartável.
 *
 * Auth é onde um erro passa despercebido até alguém entrar sem saber a senha.
 *
 * Uso: npm run verify:auth
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync, readdirSync } from 'node:fs';
import { openDatabase } from '../src/db/open';

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++;
    console.log(`  FALHOU  ${label}: esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
  } else {
    console.log(`  ok      ${label} = ${JSON.stringify(actual)}`);
  }
}

/**
 * O cookie é assinado por src/lib/auth.ts, que importa 'server-only' e
 * next/headers — nada disso roda fora do Next. Reproduzimos aqui só a
 * ASSINATURA, para provar a propriedade que interessa: trocar a senha muda a
 * chave, e todo cookie emitido antes para de validar.
 */
function signWith(secret: string, fingerprint: string, payload: string): string {
  const { createHmac } = require('node:crypto');
  return createHmac('sha256', `${secret}:${fingerprint}`).update(payload).digest('base64url');
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'promo-auth-'));
  process.env.DATABASE_PATH = join(dir, 'auth.db');
  process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
  process.env.ADMIN_PASSWORD = 'senha-inicial-do-ambiente';

  const db = openDatabase(process.env.DATABASE_PATH);
  for (const file of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) {
      if (stmt.trim()) db.exec(stmt);
    }
  }
  db.close();

  const { verifyPassword, setAdminPassword } = await import('../src/lib/password');

  console.log('\n== senha inicial vem do ambiente ==');
  check('senha do ambiente entra', await verifyPassword('senha-inicial-do-ambiente'), true);
  check('senha errada nao entra', await verifyPassword('chute'), false);
  check('senha vazia nao entra', await verifyPassword(''), false);

  console.log('\n== apos trocar pela tela, o banco manda ==');
  await setAdminPassword('senha-nova-do-banco');
  check('senha nova entra', await verifyPassword('senha-nova-do-banco'), true);
  check('senha ANTIGA do ambiente nao entra mais', await verifyPassword('senha-inicial-do-ambiente'), false);

  console.log('\n== o hash guardado ==');
  const db2 = openDatabase(process.env.DATABASE_PATH);
  const row = db2.prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'").get() as {
    value: string;
  };
  check('e scrypt', row.value.startsWith('scrypt:'), true);
  check('nao contem a senha em texto', row.value.includes('senha-nova-do-banco'), false);

  await setAdminPassword('senha-nova-do-banco');
  const row2 = db2.prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'").get() as {
    value: string;
  };
  // Sal por senha: a mesma senha gera hash diferente, entao dois bancos com a
  // mesma senha nao se denunciam, e tabelas prontas nao servem.
  check('mesma senha -> hash diferente (sal)', row.value !== row2.value, true);
  db2.close();

  console.log('\n== trocar a senha derruba sessoes abertas ==');
  const secret = process.env.SESSION_SECRET;
  const payload = `${Date.now() + 60000}.nonce123`;

  const fingerprintAntes = row2.value;
  const cookieAntigo = signWith(secret, fingerprintAntes, payload);

  await setAdminPassword('mais-uma-senha');
  const db3 = openDatabase(process.env.DATABASE_PATH);
  const fingerprintDepois = (
    db3.prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'").get() as { value: string }
  ).value;
  db3.close();

  const cookieRecalculado = signWith(secret, fingerprintDepois, payload);
  check('a assinatura muda com a senha', cookieAntigo !== cookieRecalculado, true);
  check('cookie emitido antes nao valida mais', cookieAntigo === cookieRecalculado, false);

  // A conexão preguiçosa de src/db/client.ts fica no globalThis e segura o
  // arquivo aberto; no Windows, apagar a pasta com o handle aberto dá EPERM.
  const globalDb = globalThis as unknown as { sqlite?: { close(): void } };
  globalDb.sqlite?.close();
  rmSync(dir, { recursive: true, force: true });

  console.log(`\n${'-'.repeat(46)}`);
  if (failures) {
    console.log(`${failures} de ${checks} verificacoes FALHARAM`);
    process.exit(1);
  }
  console.log(`todas as ${checks} verificacoes passaram`);
}

main().catch((err) => {
  console.error('erro:', err);
  process.exit(1);
});

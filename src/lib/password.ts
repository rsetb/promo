import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { settings } from '@/db/schema';

/**
 * A senha do admin: onde mora e como é conferida.
 *
 * Separado de auth.ts (que cuida do cookie de sessão) porque aqui não há nada
 * de HTTP — e assim scripts/verify-auth.ts consegue exercitar este código, que
 * é o que decide quem entra. auth.ts importa 'server-only' e next/headers, que
 * só existem dentro do Next.
 */

const PASSWORD_KEY = 'admin_password_hash';

/**
 * Compara sem vazar informação pelo tempo de execução. Passa por SHA-256 antes
 * porque timingSafeEqual exige buffers do mesmo tamanho — e o próprio
 * comprimento da senha seria um vazamento.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Hash da senha: scrypt, com sal por senha.
 *
 * scrypt é lento e usa memória de propósito — quem levar o arquivo do banco não
 * consegue testar bilhões de senhas por segundo, como faria contra SHA-256. Vem
 * do node:crypto, sem dependência nova.
 */
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`;
}

function verifyHash(password: string, stored: string): boolean {
  const [scheme, saltHex, keyHex] = stored.split(':');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

export async function getStoredPasswordHash(): Promise<string | null> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, PASSWORD_KEY))
    .limit(1);
  return row?.value ?? null;
}

/**
 * Confere a senha.
 *
 * Enquanto o admin não trocar a senha pela tela, vale a ADMIN_PASSWORD do
 * ambiente — é ela que dá o primeiro acesso. Depois da primeira troca o banco
 * manda, e mexer na variável de ambiente deixa de ter efeito.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const stored = await getStoredPasswordHash();
  if (stored) return verifyHash(password, stored);

  const fromEnv = process.env.ADMIN_PASSWORD;
  if (!fromEnv) throw new Error('ADMIN_PASSWORD não definida e nenhuma senha salva no banco.');
  return safeEqual(password, fromEnv);
}

export async function setAdminPassword(password: string): Promise<void> {
  const value = hashPassword(password);
  await db
    .insert(settings)
    .values({ key: PASSWORD_KEY, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    });
}

/**
 * Impressão digital da senha vigente, usada na assinatura do cookie.
 *
 * É isto que faz trocar a senha derrubar as sessões abertas: o hash muda, a
 * chave de assinatura muda junto, e todo cookie emitido antes deixa de validar.
 * Sem isso, quem tivesse entrado com a senha vazada continuaria dentro depois
 * da troca — que é justamente quando alguém troca a senha.
 */
export async function getPasswordFingerprint(): Promise<string> {
  const stored = await getStoredPasswordHash();
  return stored ?? `env:${process.env.ADMIN_PASSWORD ?? ''}`;
}

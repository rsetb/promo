import 'server-only';

import { cookies } from 'next/headers';
import { createHmac, randomBytes } from 'node:crypto';
import { getPasswordFingerprint, safeEqual } from '@/lib/password';

export { verifyPassword, setAdminPassword } from '@/lib/password';

const COOKIE_NAME = 'mr_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dias

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // Falha alto em vez de assinar com um segredo fraco/ausente: um cookie
    // assinado com segredo previsível é o mesmo que não ter autenticação.
    throw new Error('SESSION_SECRET ausente ou com menos de 32 caracteres.');
  }
  return secret;
}

/**
 * A chave de assinatura mistura o SESSION_SECRET com a impressão digital da
 * senha vigente. Por isso trocar a senha invalida todos os cookies emitidos
 * antes — ver src/lib/password.ts.
 */
async function sign(payload: string): Promise<string> {
  const key = `${getSecret()}:${await getPasswordFingerprint()}`;
  return createHmac('sha256', key).update(payload).digest('base64url');
}

/**
 * Token: `<expiraEm>.<nonce>.<assinatura>`. O nonce impede que dois logins no
 * mesmo segundo gerem tokens idênticos.
 */
async function createToken(): Promise<string> {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const nonce = randomBytes(16).toString('base64url');
  const payload = `${exp}.${nonce}`;
  return `${payload}.${await sign(payload)}`;
}

async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [exp, nonce, signature] = parts;
  if (!safeEqual(await sign(`${exp}.${nonce}`), signature)) return false;

  const expiresAt = Number(exp);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

/**
 * Limite de tentativas de login, na memória do processo.
 *
 * Com uma senha única, o login é o único alvo de força bruta que existe.
 * Rodando uma instância só (o caso no EasyPanel) isso basta; se um dia houver
 * réplicas, cada uma terá seu contador e o limite precisa ir para o banco.
 */
const attempts = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

export function clearRateLimit(key: string): void {
  attempts.delete(key);
}

export async function createSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, await createToken(), {
    httpOnly: true, // fora do alcance de JavaScript, inclusive de um XSS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Fonte única de verdade sobre "é admin?". Server Components usam para decidir
 * o que renderizar; Server Actions usam para decidir se executam. As duas
 * checagens são obrigatórias: esconder o botão não protege a ação.
 */
export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyToken(cookieStore.get(COOKIE_NAME)?.value);
}

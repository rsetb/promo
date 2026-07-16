import 'server-only';

import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual, randomBytes, createHash } from 'node:crypto';

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

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

/**
 * Compara dois valores sem vazar informação pelo tempo de execução.
 * Passa por SHA-256 antes porque timingSafeEqual exige buffers do mesmo
 * tamanho — e o próprio comprimento da senha seria um vazamento.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Token: `<expiraEm>.<nonce>.<assinatura>`. O nonce impede que dois logins no
 * mesmo segundo gerem tokens idênticos.
 */
function createToken(): string {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const nonce = randomBytes(16).toString('base64url');
  const payload = `${exp}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [exp, nonce, signature] = parts;
  if (!safeEqual(sign(`${exp}.${nonce}`), signature)) return false;

  const expiresAt = Number(exp);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

/**
 * Limite de tentativas de login, na memória do processo.
 *
 * Com uma senha única, o login é o único alvo de força bruta que existe.
 * Rodando uma instância só (o caso no EasyPanel) isso basta; se um dia houver
 * réplicas, cada uma terá seu próprio contador e o limite precisa ir para o
 * Postgres ou Redis.
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

export function verifyPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error('ADMIN_PASSWORD não definida no ambiente.');
  }
  return safeEqual(password, expected);
}

export async function createSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createToken(), {
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

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { categories, products, siteInfo } from '@/db/schema';
import {
  checkRateLimit,
  clearRateLimit,
  createSession,
  destroySession,
  isAdmin,
  verifyPassword,
} from '@/lib/auth';
import { notifyCatalogChange } from '@/lib/events';
import { parsePriceToCents } from '@/lib/format';
import type { ActionResult } from '@/lib/types';

/**
 * Toda ação de escrita passa por aqui.
 *
 * Server Actions são endpoints HTTP públicos: o Next expõe um ID para cada uma
 * e qualquer pessoa pode invocá-las diretamente, sem passar pela nossa UI.
 * Esconder o botão no client não protege nada — a checagem tem que estar aqui.
 */
async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error('Não autorizado.');
  }
}

/**
 * Fecha toda escrita: invalida os caminhos e avisa as abas abertas.
 *
 * Existe para que "avisar" não seja um passo que se esquece. Uma escrita que
 * não chame isto continua salvando certo — e fica muda: a tela de quem estiver
 * com a página aberta em outro dispositivo não se atualiza, e o bug aparece só
 * naquele ponto.
 */
function publishChange(scope: 'catalog' | 'site'): void {
  if (scope === 'site') {
    revalidatePath('/', 'layout');
  } else {
    revalidatePath('/');
    revalidatePath('/admin/categories');
  }
  notifyCatalogChange();
}


// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

export async function login(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const password = String(formData.get('password') ?? '');

  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';

  if (!checkRateLimit(ip)) {
    return { ok: false, error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' };
  }

  if (!password || !verifyPassword(password)) {
    // Mensagem genérica de propósito: não confirma nem nega nada além do óbvio.
    return { ok: false, error: 'Senha incorreta.' };
  }

  clearRateLimit(ip);
  await createSession();
  redirect('/');
}

export async function logout(): Promise<void> {
  await destroySession();
  revalidatePath('/', 'layout');
  redirect('/');
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

const productSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.').max(200),
  price: z.string(),
  categoryId: z.coerce.number().int().positive('Selecione uma categoria.'),
});

export async function createProduct(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = productSchema.safeParse({
    name: formData.get('name'),
    price: formData.get('price') ?? '',
    categoryId: formData.get('categoryId'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await db.insert(products).values({
    name: parsed.data.name,
    priceCents: parsePriceToCents(parsed.data.price),
    categoryId: parsed.data.categoryId,
    description: '',
  });

  publishChange('catalog');
  return { ok: true };
}

export async function updateProduct(id: number, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = productSchema.safeParse({
    name: formData.get('name'),
    price: formData.get('price') ?? '',
    categoryId: formData.get('categoryId'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await db
    .update(products)
    .set({
      name: parsed.data.name,
      priceCents: parsePriceToCents(parsed.data.price),
      categoryId: parsed.data.categoryId,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));

  publishChange('catalog');
  return { ok: true };
}

export async function deleteProduct(id: number): Promise<ActionResult> {
  await requireAdmin();
  await db.delete(products).where(eq(products.id, id));
  publishChange('catalog');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.').max(100),
});

export async function createCategory(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = categorySchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const name = parsed.data.name.toUpperCase();

  try {
    await db.insert(categories).values({ name });
  } catch (error) {
    // O banco é quem garante a unicidade; aqui só traduzimos para uma
    // mensagem legível.
    if (isUniqueViolation(error)) {
      return { ok: false, error: `A categoria "${name}" já existe.` };
    }
    throw error;
  }

  publishChange('catalog');
  return { ok: true };
}

export async function updateCategory(id: number, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = categorySchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const name = parsed.data.name.toUpperCase();

  try {
    await db.update(categories).set({ name }).where(eq(categories.id, id));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: `A categoria "${name}" já existe.` };
    }
    throw error;
  }

  publishChange('catalog');
  return { ok: true };
}

export async function deleteCategory(id: number): Promise<ActionResult> {
  await requireAdmin();

  try {
    await db.delete(categories).where(eq(categories.id, id));
  } catch (error) {
    // A categoria ainda tem produtos: o FK com onDelete: 'restrict' impede
    // que eles fiquem órfãos.
    if (isForeignKeyViolation(error)) {
      return {
        ok: false,
        error: 'Esta categoria ainda tem produtos. Mova ou exclua os produtos antes.',
      };
    }
    throw error;
  }

  publishChange('catalog');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Informações do site
// ---------------------------------------------------------------------------

const siteFieldSchema = z.object({
  field: z.enum([
    'siteName',
    'heroTitle1',
    'heroTitle2',
    'heroSlogan',
    'heroLocation',
    'heroPhoneDisplay',
    'heroLocation2',
    'heroPhoneDisplay2',
  ]),
  value: z.string().trim().min(1, 'O valor não pode ficar vazio.').max(300),
});

export async function updateSiteField(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = siteFieldSchema.safeParse({
    field: formData.get('field'),
    value: formData.get('value'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { field, value } = parsed.data;
  const patch: Record<string, string | Date> = { [field]: value, updatedAt: new Date() };

  // O número exibido e o número usado no link do WhatsApp precisam andar juntos;
  // derivamos um do outro para não dessincronizarem.
  if (field === 'heroPhoneDisplay') patch.heroPhone = value.replace(/\D/g, '');
  if (field === 'heroPhoneDisplay2') patch.heroPhone2 = value.replace(/\D/g, '');

  await db.update(siteInfo).set(patch).where(eq(siteInfo.id, 1));

  publishChange('site');
  return { ok: true };
}

// ---------------------------------------------------------------------------

function hasSqliteCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

/** Nome de categoria repetido (índice UNIQUE em categories.name). */
function isUniqueViolation(error: unknown): boolean {
  return hasSqliteCode(error, 'SQLITE_CONSTRAINT_UNIQUE');
}

/**
 * Categoria ainda referenciada por produtos (FK com onDelete: 'restrict').
 * Só dispara porque a conexão liga `PRAGMA foreign_keys = ON` — ver src/db.
 */
function isForeignKeyViolation(error: unknown): boolean {
  return hasSqliteCode(error, 'SQLITE_CONSTRAINT_FOREIGNKEY');
}

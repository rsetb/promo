import 'server-only';

import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories, products, siteInfo } from '@/db/schema';
import type { ProductView, SiteInfoView } from '@/lib/types';

/**
 * Valores usados quando a tabela site_info ainda não foi populada (primeiro
 * boot, antes de rodar o seed).
 */
export const DEFAULT_SITE_INFO: SiteInfoView = {
  // null = usa o /logo.png que vem na imagem, até o admin subir um.
  logoFile: null,
  siteName: 'MR Bebidas',
  heroTitle1: 'MR BEBIDAS',
  heroTitle2: 'DISTRIBUIDORA',
  heroSlogan: 'Explore nossa seleção completa de tabacaria e bebidas premium',
  heroLocation: 'FORTALEZA',
  heroPhone: '5585994125603',
  heroPhoneDisplay: '(85) 99412-5603',
  heroLocation2: 'CUMBUCO',
  heroPhone2: '5585992234683',
  heroPhoneDisplay2: '(85) 99223-4683',
};

export async function getProducts(): Promise<ProductView[]> {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      pricePackCents: products.pricePackCents,
      priceUnitCents: products.priceUnitCents,
      categoryId: products.categoryId,
      category: categories.name,
      imageFile: products.imageFile,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(asc(products.name));

  return rows;
}

export async function getCategories() {
  return db.select().from(categories).orderBy(asc(categories.name));
}

export async function getSiteInfo(): Promise<SiteInfoView> {
  const [row] = await db.select().from(siteInfo).where(eq(siteInfo.id, 1)).limit(1);
  if (!row) return DEFAULT_SITE_INFO;

  const { id, updatedAt, ...view } = row;
  return view;
}

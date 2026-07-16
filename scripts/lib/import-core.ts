/**
 * Núcleo do import, independente de driver.
 *
 * Recebe uma função de query compatível tanto com `pg` (Postgres real) quanto
 * com PGlite (Postgres em WASM, usado na verificação). Assim o teste exercita
 * exatamente o mesmo caminho de código da migração de produção.
 */
import { buildCategories, buildProducts, type FirestoreExport, type DedupeDecision } from './transform';

export type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;

export const DEFAULT_SITE_INFO = {
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

export type ImportStats = {
  categories: number;
  products: number;
  decisions: DedupeDecision[];
};

export async function importData(query: QueryFn, data: FirestoreExport): Promise<ImportStats> {
  const categoryNames = buildCategories(data);
  const { products, decisions } = buildProducts(data);

  const categoryIds = new Map<string, number>();
  for (const name of categoryNames) {
    const result = await query(
      `INSERT INTO categories (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [name]
    );
    categoryIds.set(name, result.rows[0].id);
  }

  for (const product of products) {
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) throw new Error(`Categoria não encontrada: ${product.category}`);

    await query(`INSERT INTO products (name, description, price, category_id) VALUES ($1, $2, $3, $4)`, [
      product.name,
      product.description,
      product.price,
      categoryId,
    ]);
  }

  const siteInfo = { ...DEFAULT_SITE_INFO, ...(data.siteInfo ?? {}) };
  await query(
    `INSERT INTO site_info (
       id, site_name, hero_title_1, hero_title_2, hero_slogan,
       hero_location, hero_phone, hero_phone_display,
       hero_location_2, hero_phone_2, hero_phone_display_2
     ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       site_name = EXCLUDED.site_name,
       hero_title_1 = EXCLUDED.hero_title_1,
       hero_title_2 = EXCLUDED.hero_title_2,
       hero_slogan = EXCLUDED.hero_slogan,
       hero_location = EXCLUDED.hero_location,
       hero_phone = EXCLUDED.hero_phone,
       hero_phone_display = EXCLUDED.hero_phone_display,
       hero_location_2 = EXCLUDED.hero_location_2,
       hero_phone_2 = EXCLUDED.hero_phone_2,
       hero_phone_display_2 = EXCLUDED.hero_phone_display_2,
       updated_at = now()`,
    [
      siteInfo.siteName,
      siteInfo.heroTitle1,
      siteInfo.heroTitle2,
      siteInfo.heroSlogan,
      siteInfo.heroLocation,
      siteInfo.heroPhone,
      siteInfo.heroPhoneDisplay,
      siteInfo.heroLocation2,
      siteInfo.heroPhone2,
      siteInfo.heroPhoneDisplay2,
    ]
  );

  return { categories: categoryNames.length, products: products.length, decisions };
}

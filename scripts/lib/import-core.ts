/**
 * Núcleo do import, independente de como o SQLite é aberto.
 *
 * Recebe uma função de query para que o import de produção e o teste de
 * verificação usem exatamente o mesmo caminho de código.
 */
import { buildCategories, buildProducts, type CatalogExport, type DedupeDecision } from './transform';

export type QueryFn = (sql: string, params?: unknown[]) => { rows: any[] };

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

export function importData(query: QueryFn, data: CatalogExport): ImportStats {
  const categoryNames = buildCategories(data);
  const { products, decisions } = buildProducts(data);

  const categoryIds = new Map<string, number>();
  for (const name of categoryNames) {
    // RETURNING existe no SQLite moderno, mas ler de volta por nome é simples e
    // funciona igual quando a categoria já existe.
    query(`INSERT OR IGNORE INTO categories (name) VALUES (?)`, [name]);
    const { rows } = query(`SELECT id FROM categories WHERE name = ?`, [name]);
    categoryIds.set(name, rows[0].id);
  }

  for (const product of products) {
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) throw new Error(`Categoria não encontrada: ${product.category}`);

    query(`INSERT INTO products (name, description, price_cents, category_id) VALUES (?, ?, ?, ?)`, [
      product.name,
      product.description,
      product.priceCents,
      categoryId,
    ]);
  }

  const siteInfo = { ...DEFAULT_SITE_INFO, ...(data.siteInfo ?? {}) };
  query(
    `INSERT INTO site_info (
       id, site_name, hero_title_1, hero_title_2, hero_slogan,
       hero_location, hero_phone, hero_phone_display,
       hero_location_2, hero_phone_2, hero_phone_display_2
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       site_name = excluded.site_name,
       hero_title_1 = excluded.hero_title_1,
       hero_title_2 = excluded.hero_title_2,
       hero_slogan = excluded.hero_slogan,
       hero_location = excluded.hero_location,
       hero_phone = excluded.hero_phone,
       hero_phone_display = excluded.hero_phone_display,
       hero_location_2 = excluded.hero_location_2,
       hero_phone_2 = excluded.hero_phone_2,
       hero_phone_display_2 = excluded.hero_phone_display_2,
       updated_at = unixepoch()`,
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

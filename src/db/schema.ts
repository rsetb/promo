import { sqliteTable, integer, text, check } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

/**
 * Categorias do catálogo.
 *
 * `name` é UNIQUE: no banco antigo as categorias eram criadas com ID automático
 * e sem verificação, o que produziu 80 registros para 23 categorias reais. Aqui
 * o banco recusa a duplicata.
 */
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Produtos.
 *
 * `price_cents` guarda o preço em CENTAVOS, como inteiro. SQLite não tem tipo
 * decimal — sobrariam REAL (ponto flutuante, que acumula erro em dinheiro) ou
 * TEXT (sem aritmética nem ordenação numérica). Inteiro em centavos é exato:
 * R$ 137,80 vira 13780.
 *
 * NULL significa "sem preço definido" e a UI mostra "Consulte". No banco antigo
 * esse estado tinha duas representações (null e 0); aqui só existe uma.
 */
export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    priceCents: integer('price_cents'),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    check('price_non_negative', sql`${t.priceCents} IS NULL OR ${t.priceCents} >= 0`),
    check('name_not_empty', sql`length(trim(${t.name})) > 0`),
  ]
);

/**
 * Textos e telefones do site. Tabela de linha única: o CHECK em `id` garante
 * que nunca exista uma segunda linha para o app escolher.
 */
export const siteInfo = sqliteTable(
  'site_info',
  {
    id: integer('id').primaryKey().default(1),
    siteName: text('site_name').notNull(),
    heroTitle1: text('hero_title_1').notNull(),
    heroTitle2: text('hero_title_2').notNull(),
    heroSlogan: text('hero_slogan').notNull(),
    heroLocation: text('hero_location').notNull(),
    heroPhone: text('hero_phone').notNull(),
    heroPhoneDisplay: text('hero_phone_display').notNull(),
    heroLocation2: text('hero_location_2').notNull(),
    heroPhone2: text('hero_phone_2').notNull(),
    heroPhoneDisplay2: text('hero_phone_display_2').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [check('single_row', sql`${t.id} = 1`)]
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type ProductRow = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type SiteInfo = typeof siteInfo.$inferSelect;

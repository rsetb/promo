import { pgTable, serial, text, numeric, integer, timestamp, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

/**
 * Categorias do catálogo.
 *
 * `name` é UNIQUE: no Firestore as categorias eram criadas com ID automático e
 * sem verificação, o que produziu 80 registros para 23 categorias reais. Aqui o
 * banco recusa a duplicata.
 */
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Produtos.
 *
 * `price` é NULL quando não há preço definido — a UI mostra "Consulte". No
 * Firestore esse estado tinha duas representações (null e 0); aqui só existe uma.
 * Usamos numeric(10,2) em vez de float: preço em ponto flutuante acumula erro.
 */
export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    price: numeric('price', { precision: 10, scale: 2, mode: 'number' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('price_non_negative', sql`${t.price} IS NULL OR ${t.price} >= 0`),
    check('name_not_empty', sql`length(trim(${t.name})) > 0`),
  ]
);

/**
 * Textos e telefones do site. Tabela de linha única: o CHECK em `id` garante
 * que nunca exista uma segunda linha para o app escolher.
 */
export const siteInfo = pgTable(
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
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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

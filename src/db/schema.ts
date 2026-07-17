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
 * Dois preços independentes, ambos em CENTAVOS como inteiro: o fardo (caixa) e
 * a unidade. Cada um é NULL quando não há preço definido — a vitrine mostra só
 * os que existem, e "Consulte" quando não há nenhum.
 *
 * Centavos porque o SQLite não tem tipo decimal: sobrariam REAL (ponto
 * flutuante, que acumula erro em dinheiro) ou TEXT (sem aritmética nem
 * ordenação numérica). Inteiro é exato: R$ 137,80 vira 13780.
 */
export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    /**
     * Os três jeitos de vender, em centavos. Cada um é NULL quando o produto
     * não é vendido daquela forma; nenhum preenchido = "Consulte".
     *
     * São colunas, e não uma tabela de preços, porque o vocabulário é fixo do
     * negócio (unidade, fardo, caixa) e não algo que o admin inventa. Uma
     * tabela traria join e código a mais para flexibilidade que ninguém pediu.
     */
    priceUnitCents: integer('price_unit_cents'),
    pricePackCents: integer('price_pack_cents'),
    priceBoxCents: integer('price_box_cents'),
    /**
     * Quantas unidades cabem no fardo e na caixa, para a vitrine dizer
     * "Fardo 12un — R$ 35,70". NULL mostra só "Fardo": nem todo produto tem uma
     * quantidade fixa, e inventar um número seria pior que omitir.
     */
    packQty: integer('pack_qty'),
    boxQty: integer('box_qty'),
    /**
     * Nome do arquivo da foto no volume (ex.: "a1b2...f9.webp"), ou NULL.
     * Só o nome, nunca um caminho: quem resolve o diretório é src/lib/uploads.ts,
     * e assim um valor no banco não consegue apontar para fora dele.
     */
    imageFile: text('image_file'),
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
    check('price_unit_non_negative', sql`${t.priceUnitCents} IS NULL OR ${t.priceUnitCents} >= 0`),
    check('price_pack_non_negative', sql`${t.pricePackCents} IS NULL OR ${t.pricePackCents} >= 0`),
    check('price_box_non_negative', sql`${t.priceBoxCents} IS NULL OR ${t.priceBoxCents} >= 0`),
    // Quantidade zero ou negativa não existe: "Fardo 0un" é sempre um erro de
    // digitação, não um estado válido.
    check('pack_qty_positive', sql`${t.packQty} IS NULL OR ${t.packQty} > 0`),
    check('box_qty_positive', sql`${t.boxQty} IS NULL OR ${t.boxQty} > 0`),
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
    /**
     * Nome do arquivo do logo no volume, ou NULL para usar o /logo.png que vem
     * na imagem. Mesmo formato e mesma pasta das fotos de produto.
     */
    logoFile: text('logo_file'),
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

/**
 * Configurações que o admin muda pela tela e que não cabem em site_info —
 * hoje só o hash da senha.
 *
 * Tabela chave/valor porque é um punhado de valores soltos, sem relação entre
 * si: uma coluna por item exigiria migration a cada novo ajuste.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

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

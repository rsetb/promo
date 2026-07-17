-- Divide o preço único em dois: fardo e unidade.
--
-- Escrita à mão porque o drizzle-kit precisa de terminal interativo para
-- perguntar se price_cents foi RENOMEADO ou é coluna NOVA — e a resposta decide
-- entre preservar ou apagar os 215 preços que já estão no ar.
--
-- O SQLite não permite alterar CHECK com ALTER TABLE, então a tabela é
-- recriada. A cópia carrega os dados: nenhum produto, foto ou preço se perde.
--
-- REGRA DE MIGRAÇÃO DOS PREÇOS (confirmada com o dono do catálogo, a partir das
-- médias por categoria):
--   destilados (VODKAS, WHISKYS, GIN, LICORES, VINHOS, DESTILADOS) -> UNIDADE
--     ABSOLUT a R$ 66,90 é o preço de uma garrafa.
--   todo o resto -> FARDO
--     CERVEJAS LATAS a R$ 36,23 de média não é o preço de uma lata; é a caixa.
CREATE TABLE `__new_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_pack_cents` integer,
	`price_unit_cents` integer,
	`image_file` text,
	`category_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "price_pack_non_negative" CHECK("__new_products"."price_pack_cents" IS NULL OR "__new_products"."price_pack_cents" >= 0),
	CONSTRAINT "price_unit_non_negative" CHECK("__new_products"."price_unit_cents" IS NULL OR "__new_products"."price_unit_cents" >= 0),
	CONSTRAINT "name_not_empty" CHECK(length(trim("__new_products"."name")) > 0)
);
--> statement-breakpoint
INSERT INTO `__new_products` (
  `id`, `name`, `description`, `price_pack_cents`, `price_unit_cents`,
  `image_file`, `category_id`, `created_at`, `updated_at`
)
SELECT
  p.`id`, p.`name`, p.`description`,
  CASE WHEN c.`name` IN ('VODKAS','WHISKYS','GIN','LICORES','VINHOS','DESTILADOS')
       THEN NULL ELSE p.`price_cents` END,
  CASE WHEN c.`name` IN ('VODKAS','WHISKYS','GIN','LICORES','VINHOS','DESTILADOS')
       THEN p.`price_cents` ELSE NULL END,
  p.`image_file`, p.`category_id`, p.`created_at`, p.`updated_at`
FROM `products` p
JOIN `categories` c ON c.`id` = p.`category_id`;
--> statement-breakpoint
DROP TABLE `products`;
--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;

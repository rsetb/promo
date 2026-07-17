-- Adiciona o preço de caixa e as quantidades por fardo/caixa.
--
-- O SQLite não permite adicionar CHECK com ALTER TABLE, então a tabela é
-- recriada. A cópia preserva tudo; as colunas novas nascem NULL.
--
-- CORRIGIDA À MÃO: o drizzle-kit gerou o INSERT ... SELECT incluindo
-- price_box_cents, pack_qty e box_qty na leitura da tabela ANTIGA, onde essas
-- colunas ainda não existem — falharia com "no such column" no meio do deploy,
-- com a tabela nova já criada. Colunas novas não entram no SELECT.
CREATE TABLE `__new_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_unit_cents` integer,
	`price_pack_cents` integer,
	`price_box_cents` integer,
	`pack_qty` integer,
	`box_qty` integer,
	`image_file` text,
	`category_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "price_unit_non_negative" CHECK("__new_products"."price_unit_cents" IS NULL OR "__new_products"."price_unit_cents" >= 0),
	CONSTRAINT "price_pack_non_negative" CHECK("__new_products"."price_pack_cents" IS NULL OR "__new_products"."price_pack_cents" >= 0),
	CONSTRAINT "price_box_non_negative" CHECK("__new_products"."price_box_cents" IS NULL OR "__new_products"."price_box_cents" >= 0),
	CONSTRAINT "pack_qty_positive" CHECK("__new_products"."pack_qty" IS NULL OR "__new_products"."pack_qty" > 0),
	CONSTRAINT "box_qty_positive" CHECK("__new_products"."box_qty" IS NULL OR "__new_products"."box_qty" > 0),
	CONSTRAINT "name_not_empty" CHECK(length(trim("__new_products"."name")) > 0)
);
--> statement-breakpoint
INSERT INTO `__new_products` (
  "id", "name", "description", "price_unit_cents", "price_pack_cents",
  "image_file", "category_id", "created_at", "updated_at"
)
SELECT
  "id", "name", "description", "price_unit_cents", "price_pack_cents",
  "image_file", "category_id", "created_at", "updated_at"
FROM `products`;
--> statement-breakpoint
DROP TABLE `products`;
--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;

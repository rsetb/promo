CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_cents` integer,
	`category_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "price_non_negative" CHECK("products"."price_cents" IS NULL OR "products"."price_cents" >= 0),
	CONSTRAINT "name_not_empty" CHECK(length(trim("products"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE `site_info` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`site_name` text NOT NULL,
	`hero_title_1` text NOT NULL,
	`hero_title_2` text NOT NULL,
	`hero_slogan` text NOT NULL,
	`hero_location` text NOT NULL,
	`hero_phone` text NOT NULL,
	`hero_phone_display` text NOT NULL,
	`hero_location_2` text NOT NULL,
	`hero_phone_2` text NOT NULL,
	`hero_phone_display_2` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "single_row" CHECK("site_info"."id" = 1)
);

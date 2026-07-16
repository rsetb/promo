CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" numeric(10, 2),
	"category_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_non_negative" CHECK ("products"."price" IS NULL OR "products"."price" >= 0),
	CONSTRAINT "name_not_empty" CHECK (length(trim("products"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "site_info" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"site_name" text NOT NULL,
	"hero_title_1" text NOT NULL,
	"hero_title_2" text NOT NULL,
	"hero_slogan" text NOT NULL,
	"hero_location" text NOT NULL,
	"hero_phone" text NOT NULL,
	"hero_phone_display" text NOT NULL,
	"hero_location_2" text NOT NULL,
	"hero_phone_2" text NOT NULL,
	"hero_phone_display_2" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "single_row" CHECK ("site_info"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
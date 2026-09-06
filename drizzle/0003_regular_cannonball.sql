CREATE TABLE `item` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sku` text,
	`unit` text,
	`default_price` real DEFAULT 0 NOT NULL,
	`tax_rate` real,
	`weight` real,
	`length` real,
	`width` real,
	`height` real,
	`invoice_type` text DEFAULT 'general' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `item_name_idx` ON `item` (`name`);--> statement-breakpoint
CREATE INDEX `item_sku_idx` ON `item` (`sku`);--> statement-breakpoint
CREATE INDEX `item_invoice_type_idx` ON `item` (`invoice_type`);
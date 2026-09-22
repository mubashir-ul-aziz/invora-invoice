CREATE TABLE `subscription_state` (
	`id` text PRIMARY KEY NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`is_active` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`will_renew` integer DEFAULT 0 NOT NULL,
	`billing_issue` integer DEFAULT 0 NOT NULL,
	`billing_period` text,
	`last_synced_at` integer,
	`source` text DEFAULT 'default' NOT NULL,
	`clock_high_water_ms` integer DEFAULT 0 NOT NULL,
	`usage_period_key` text,
	`usage_count` integer,
	`signature` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `business` ADD `business_code` text;--> statement-breakpoint
ALTER TABLE `business` ADD `custom_units` text;--> statement-breakpoint
ALTER TABLE `customer` ADD `website` text;--> statement-breakpoint
ALTER TABLE `invoice_item` ADD `pricing_method` text;--> statement-breakpoint
ALTER TABLE `invoice_item` ADD `weight_unit` text;--> statement-breakpoint
ALTER TABLE `invoice_item` ADD `length_unit` text;--> statement-breakpoint
ALTER TABLE `invoice_item` ADD `time_unit` text;--> statement-breakpoint
ALTER TABLE `invoice_item` ADD `price_mode` text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE `item` ADD `price_mode` text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE `item` ADD `weight_unit` text;--> statement-breakpoint
ALTER TABLE `item` ADD `length_unit` text;
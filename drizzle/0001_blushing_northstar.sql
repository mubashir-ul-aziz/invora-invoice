ALTER TABLE `business` ADD `invoice_prefix` text DEFAULT 'INV-' NOT NULL;--> statement-breakpoint
ALTER TABLE `business` ADD `next_invoice_number` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `business` ADD `default_tax_rate` real;--> statement-breakpoint
ALTER TABLE `business` ADD `default_payment_terms_days` integer;--> statement-breakpoint
ALTER TABLE `business` ADD `default_invoice_template` text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE `business` ADD `invoice_type` text DEFAULT 'general' NOT NULL;
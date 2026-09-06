CREATE TABLE `invoice` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_number` text NOT NULL,
	`customer_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`invoice_type` text NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text,
	`notes` text,
	`terms` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_number_idx` ON `invoice` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `invoice_customer_idx` ON `invoice` (`customer_id`);--> statement-breakpoint
CREATE INDEX `invoice_issue_date_idx` ON `invoice` (`issue_date`);--> statement-breakpoint
CREATE TABLE `invoice_item` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`item_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`item_name` text NOT NULL,
	`description` text,
	`sku` text,
	`quantity` real,
	`unit` text,
	`weight` real,
	`length` real,
	`width` real,
	`height` real,
	`unit_price` real NOT NULL,
	`discount_percent` real,
	`tax_percent` real,
	`subtotal` real NOT NULL,
	`discount_amount` real NOT NULL,
	`tax_amount` real NOT NULL,
	`line_total` real NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoice`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `invoice_item_invoice_idx` ON `invoice_item` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `invoice_item_item_idx` ON `invoice_item` (`item_id`);
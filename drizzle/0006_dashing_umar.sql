CREATE TABLE `payment` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`customer_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`amount` real NOT NULL,
	`payment_date` text NOT NULL,
	`method` text NOT NULL,
	`reference` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoice`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_invoice_idx` ON `payment` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `payment_customer_idx` ON `payment` (`customer_id`);--> statement-breakpoint
CREATE INDEX `payment_date_idx` ON `payment` (`payment_date`);
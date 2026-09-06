CREATE TABLE `customer` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_name_idx` ON `customer` (`name`);--> statement-breakpoint
CREATE INDEX `customer_phone_idx` ON `customer` (`phone`);
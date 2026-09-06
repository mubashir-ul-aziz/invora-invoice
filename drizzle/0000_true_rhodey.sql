CREATE TABLE `business` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`owner_name` text,
	`logo_uri` text,
	`phone` text,
	`email` text,
	`website` text,
	`address` text,
	`currency` text DEFAULT 'USD' NOT NULL,
	`tax_id` text,
	`share_slug` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `social_link` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`platform` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_link_business_platform_idx` ON `social_link` (`business_id`,`platform`);
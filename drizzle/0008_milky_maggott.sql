CREATE TABLE `backup_log` (
	`id` text PRIMARY KEY NOT NULL,
	`direction` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`destination` text DEFAULT 'google_drive' NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`format_version` integer,
	`size_bytes` integer,
	`item_counts` text,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `backup_log_started_at_idx` ON `backup_log` (`started_at`);--> statement-breakpoint
ALTER TABLE `app_settings` ADD `auto_backup_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `last_backup_at` integer;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `last_backup_status` text;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `last_backup_error` text;
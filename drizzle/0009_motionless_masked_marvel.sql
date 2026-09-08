ALTER TABLE `app_settings` ADD `cloud_backup_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `cloud_backup_plan_id` text;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `last_cloud_backup_at` integer;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `last_cloud_backup_status` text;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `last_cloud_backup_error` text;
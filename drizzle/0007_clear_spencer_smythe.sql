CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`app_lock_enabled` integer DEFAULT 0 NOT NULL,
	`biometric_unlock_enabled` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

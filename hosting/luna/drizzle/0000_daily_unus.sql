CREATE TABLE `csrf_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `csrf_expires_idx` ON `csrf_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`day` text NOT NULL,
	`charge` integer NOT NULL,
	`state` text NOT NULL,
	`input` integer,
	`output` integer,
	`error_code` text,
	`returned_model` text,
	`model_verification` text
);
--> statement-breakpoint
CREATE INDEX `requests_day_idx` ON `requests` (`day`);--> statement-breakpoint
CREATE INDEX `requests_state_idx` ON `requests` (`state`);--> statement-breakpoint
CREATE INDEX `requests_at_idx` ON `requests` (`at`);
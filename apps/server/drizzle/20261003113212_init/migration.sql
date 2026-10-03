CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`at` integer NOT NULL,
	`actor_id` integer,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`order_id` integer,
	`ip` text,
	`payload` text,
	CONSTRAINT `fk_events_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_events_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY,
	`order_id` integer NOT NULL,
	`order_stage_id` integer NOT NULL,
	`field_id` text NOT NULL,
	`original_name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_by` integer NOT NULL,
	`uploaded_at` integer NOT NULL,
	CONSTRAINT `fk_files_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`),
	CONSTRAINT `fk_files_order_stage_id_order_stages_id_fk` FOREIGN KEY (`order_stage_id`) REFERENCES `order_stages`(`id`),
	CONSTRAINT `fk_files_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_stages` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`order_id` integer NOT NULL,
	`position` integer NOT NULL,
	`source_stage_id` integer,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`executor` text NOT NULL,
	`executor_role_id` integer,
	`fields` text NOT NULL,
	`values` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_by` integer,
	`completed_at` integer,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_order_stages_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`),
	CONSTRAINT `fk_order_stages_source_stage_id_stages_id_fk` FOREIGN KEY (`source_stage_id`) REFERENCES `stages`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_order_stages_executor_role_id_roles_id_fk` FOREIGN KEY (`executor_role_id`) REFERENCES `roles`(`id`),
	CONSTRAINT `fk_order_stages_completed_by_users_id_fk` FOREIGN KEY (`completed_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`number` text NOT NULL UNIQUE,
	`customer` text NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`template_id` integer NOT NULL,
	`responsible_id` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	CONSTRAINT `fk_orders_template_id_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`),
	CONSTRAINT `fk_orders_responsible_id_users_id_fk` FOREIGN KEY (`responsible_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_orders_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE,
	`permissions` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`idle_expires_at` integer NOT NULL,
	`absolute_expires_at` integer NOT NULL,
	`ip` text,
	`user_agent` text,
	CONSTRAINT `fk_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `stages` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`executor` text NOT NULL,
	`executor_role_id` integer,
	`fields` text DEFAULT '[]' NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_stages_executor_role_id_roles_id_fk` FOREIGN KEY (`executor_role_id`) REFERENCES `roles`(`id`),
	CONSTRAINT "stages_executor_role" CHECK(("executor" = 'role') = ("executor_role_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `template_stages` (
	`template_id` integer NOT NULL,
	`stage_id` integer NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT `template_stages_pk` PRIMARY KEY(`template_id`, `position`),
	CONSTRAINT `fk_template_stages_template_id_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_template_stages_stage_id_stages_id_fk` FOREIGN KEY (`stage_id`) REFERENCES `stages`(`id`)
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	CONSTRAINT `user_roles_pk` PRIMARY KEY(`user_id`, `role_id`),
	CONSTRAINT `fk_user_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_user_roles_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`login` text NOT NULL,
	`full_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE INDEX `events_at` ON `events` (`at`);--> statement-breakpoint
CREATE INDEX `events_order` ON `events` (`order_id`);--> statement-breakpoint
CREATE INDEX `events_actor` ON `events` (`actor_id`);--> statement-breakpoint
CREATE INDEX `files_order_stage` ON `files` (`order_stage_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `order_stages_position` ON `order_stages` (`order_id`,`position`);--> statement-breakpoint
CREATE INDEX `order_stages_active` ON `order_stages` (`status`,`executor`,`executor_role_id`);--> statement-breakpoint
CREATE INDEX `orders_status` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_responsible` ON `orders` (`responsible_id`);--> statement-breakpoint
CREATE INDEX `orders_template` ON `orders` (`template_id`);--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_idle` ON `sessions` (`idle_expires_at`);--> statement-breakpoint
CREATE INDEX `template_stages_stage` ON `template_stages` (`stage_id`);--> statement-breakpoint
CREATE INDEX `user_roles_role` ON `user_roles` (`role_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_login_unique` ON `users` (lower("login"));
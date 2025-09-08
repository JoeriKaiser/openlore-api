CREATE TABLE `characters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`bio` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `characters_name_idx` ON `characters` (`name`);--> statement-breakpoint
CREATE INDEX `characters_created_at_idx` ON `characters` (`created_at`);--> statement-breakpoint
CREATE TABLE `lore` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lore_title_idx` ON `lore` (`title`);--> statement-breakpoint
CREATE INDEX `lore_created_at_idx` ON `lore` (`created_at`);--> statement-breakpoint
DROP TABLE `movies`;
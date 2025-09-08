ALTER TABLE `characters` ADD `userId` text NOT NULL REFERENCES user(id);--> statement-breakpoint
CREATE INDEX `characters_user_id_idx` ON `characters` (`userId`);--> statement-breakpoint
ALTER TABLE `lore` ADD `userId` text NOT NULL REFERENCES user(id);--> statement-breakpoint
CREATE INDEX `lore_user_id_idx` ON `lore` (`userId`);
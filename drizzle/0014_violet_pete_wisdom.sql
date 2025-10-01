CREATE TABLE `rag_chunks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`sourceType` text NOT NULL,
	`sourceId` integer,
	`chatId` integer,
	`characterId` integer,
	`title` text,
	`content` text NOT NULL,
	`embedding` text NOT NULL,
	`tokenCount` integer,
	`hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rag_user_idx` ON `rag_chunks` (`userId`);--> statement-breakpoint
CREATE INDEX `rag_type_idx` ON `rag_chunks` (`sourceType`);--> statement-breakpoint
CREATE INDEX `rag_character_idx` ON `rag_chunks` (`characterId`);--> statement-breakpoint
CREATE INDEX `rag_chat_idx` ON `rag_chunks` (`chatId`);--> statement-breakpoint
CREATE UNIQUE INDEX `rag_user_source_hash_uidx` ON `rag_chunks` (`userId`,`sourceType`,`sourceId`,`hash`);
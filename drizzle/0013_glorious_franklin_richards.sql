DROP INDEX `ai_provider_key_user_provider_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `ai_provider_key_user_provider_uidx` ON `ai_provider_key` (`userId`,`provider`);
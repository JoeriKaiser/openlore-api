-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "indexing_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" text NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
-- Convert embedding column from text (JSON) to vector type
-- The USING clause handles the conversion from JSON string to vector
ALTER TABLE "rag_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(384) USING (embedding::jsonb)::text::vector(384);
--> statement-breakpoint
ALTER TABLE "indexing_jobs" ADD CONSTRAINT "indexing_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "indexing_jobs_user_idx" ON "indexing_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "indexing_jobs_status_idx" ON "indexing_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "indexing_jobs_created_at_idx" ON "indexing_jobs" USING btree ("created_at");--> statement-breakpoint
-- Clean up orphaned rag_chunks records before adding FK constraints
DELETE FROM "rag_chunks" WHERE "chat_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "chats" WHERE "chats"."id" = "rag_chunks"."chat_id");
--> statement-breakpoint
DELETE FROM "rag_chunks" WHERE "character_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "characters" WHERE "characters"."id" = "rag_chunks"."character_id");
--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Create HNSW index for fast approximate nearest neighbor search using cosine distance
CREATE INDEX "rag_chunks_embedding_idx" ON "rag_chunks" USING hnsw ("embedding" vector_cosine_ops);
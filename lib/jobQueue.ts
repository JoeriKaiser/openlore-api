import { db } from "./db";
import { indexingJobs } from "./schema";
import { and, eq, lt, or, sql } from "drizzle-orm";
import {
  indexLoreEntry,
  indexCharacterBio,
  indexMessageChunk,
  deleteChunksForSource,
} from "./rag";

export type JobType =
  | "index_lore"
  | "index_character"
  | "index_message"
  | "delete_chunks";

type JobPayload = {
  index_lore: { userId: string; id: number; title: string; content: string };
  index_character: { userId: string; id: number; name: string; bio?: string | null };
  index_message: { userId: string; chatId: number; characterId?: number | null; role: "user" | "assistant"; content: string };
  delete_chunks: { userId: string; sourceType: "lore" | "character" | "message" | "memory"; sourceId?: number | null };
};

export async function enqueueJob<T extends JobType>(
  userId: string,
  jobType: T,
  payload: JobPayload[T]
): Promise<void> {
  await db.insert(indexingJobs).values({
    userId,
    jobType,
    payload: JSON.stringify(payload),
    status: "pending",
  });
}

async function processJob(job: { id: number; jobType: string; payload: string; retryCount: number; maxRetries: number }): Promise<void> {
  const payload = JSON.parse(job.payload);

  try {
    switch (job.jobType) {
      case "index_lore":
        await indexLoreEntry(payload);
        break;
      case "index_character":
        await indexCharacterBio(payload);
        break;
      case "index_message":
        await indexMessageChunk(payload);
        break;
      case "delete_chunks":
        await deleteChunksForSource(payload.userId, payload.sourceType, payload.sourceId);
        break;
      default:
        throw new Error(`Unknown job type: ${job.jobType}`);
    }

    // Mark as completed
    await db
      .update(indexingJobs)
      .set({ status: "completed", processedAt: new Date(), updatedAt: new Date() })
      .where(eq(indexingJobs.id, job.id));

    console.log(`[JobQueue] Completed job #${job.id} (${job.jobType})`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[JobQueue] Failed to process job #${job.id} (${job.jobType}):`, error);

    // Increment retry count
    const newRetryCount = job.retryCount + 1;

    if (newRetryCount >= job.maxRetries) {
      // Max retries reached, mark as failed
      await db
        .update(indexingJobs)
        .set({
          status: "failed",
          error: errorMessage,
          retryCount: newRetryCount,
          updatedAt: new Date(),
        })
        .where(eq(indexingJobs.id, job.id));
      console.error(`[JobQueue] Job #${job.id} failed after ${newRetryCount} attempts`);
    } else {
      // Retry later
      await db
        .update(indexingJobs)
        .set({
          status: "pending",
          error: errorMessage,
          retryCount: newRetryCount,
          updatedAt: new Date(),
        })
        .where(eq(indexingJobs.id, job.id));
      console.log(`[JobQueue] Job #${job.id} will retry (attempt ${newRetryCount + 1}/${job.maxRetries})`);
    }
  }
}

export async function processNextJob(): Promise<boolean> {
  // Find the oldest pending job
  const [job] = await db
    .select({
      id: indexingJobs.id,
      jobType: indexingJobs.jobType,
      payload: indexingJobs.payload,
      retryCount: indexingJobs.retryCount,
      maxRetries: indexingJobs.maxRetries,
    })
    .from(indexingJobs)
    .where(eq(indexingJobs.status, "pending"))
    .orderBy(indexingJobs.createdAt)
    .limit(1);

  if (!job) {
    return false; // No jobs to process
  }

  // Mark as processing
  await db
    .update(indexingJobs)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(indexingJobs.id, job.id));

  await processJob(job);
  return true;
}

/**
 * Process all pending jobs for a specific user synchronously.
 * This ensures that recent lore/character updates are indexed before RAG retrieval.
 */
export async function processPendingJobsForUser(userId: string): Promise<number> {
  let processed = 0;

  while (true) {
    // Find the oldest pending job for this user
    const [job] = await db
      .select({
        id: indexingJobs.id,
        jobType: indexingJobs.jobType,
        payload: indexingJobs.payload,
        retryCount: indexingJobs.retryCount,
        maxRetries: indexingJobs.maxRetries,
      })
      .from(indexingJobs)
      .where(and(eq(indexingJobs.userId, userId), eq(indexingJobs.status, "pending")))
      .orderBy(indexingJobs.createdAt)
      .limit(1);

    if (!job) {
      break; // No more pending jobs for this user
    }

    // Mark as processing
    await db
      .update(indexingJobs)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(indexingJobs.id, job.id));

    await processJob(job);
    processed++;
  }

  if (processed > 0) {
    console.log(`[JobQueue] Processed ${processed} pending jobs for user ${userId}`);
  }

  return processed;
}

export async function startJobProcessor(intervalMs: number = 1000): Promise<() => void> {
  let running = true;

  const process = async () => {
    while (running) {
      try {
        const hadJob = await processNextJob();
        if (!hadJob) {
          // No jobs, wait before checking again
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        console.error("[JobQueue] Error in job processor:", error);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
  };

  // Start processing in background
  process().catch(err => console.error("[JobQueue] Fatal error in job processor:", err));

  // Return stop function
  return () => {
    running = false;
    console.log("[JobQueue] Job processor stopped");
  };
}

// Cleanup old completed/failed jobs (should be run periodically)
export async function cleanupOldJobs(olderThanDays: number = 7): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await db
    .delete(indexingJobs)
    .where(
      and(
        or(eq(indexingJobs.status, "completed"), eq(indexingJobs.status, "failed")),
        lt(indexingJobs.updatedAt, cutoffDate)
      )
    );

  console.log(`[JobQueue] Cleaned up old jobs`);
}

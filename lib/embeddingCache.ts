import { embedText as _embedText } from "./embeddings";

interface CacheEntry {
  embedding: number[];
  timestamp: number;
}

class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Cache configuration
const CACHE_MAX_SIZE = 1000; // Store up to 1000 recent query embeddings
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

// Global cache instance
const embeddingCache = new LRUCache<string, CacheEntry>(CACHE_MAX_SIZE);

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  // Note: We can't iterate and delete from Map efficiently, so we recreate
  const entries = Array.from(embeddingCache["cache"].entries());
  embeddingCache.clear();

  for (const [key, value] of entries) {
    if (now - value.timestamp < CACHE_TTL_MS) {
      embeddingCache.set(key, value);
    } else {
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[EmbeddingCache] Cleaned ${cleaned} expired entries`);
  }
}, 60000); // Check every minute

/**
 * Cached version of embedText that stores results in an LRU cache
 */
export async function embedText({ text }: { text: string }): Promise<number[]> {
  // Normalize text for cache key (trim and lowercase)
  const cacheKey = text.trim().toLowerCase();

  // Check cache
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_TTL_MS) {
      return cached.embedding;
    }
  }

  // Cache miss or expired, generate embedding
  const embedding = await _embedText({ text });

  // Store in cache
  embeddingCache.set(cacheKey, {
    embedding,
    timestamp: Date.now(),
  });

  return embedding;
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: embeddingCache.size(),
    maxSize: CACHE_MAX_SIZE,
    ttlMs: CACHE_TTL_MS,
  };
}

/**
 * Clear the cache (useful for testing or debugging)
 */
export function clearCache() {
  embeddingCache.clear();
  console.log("[EmbeddingCache] Cache cleared");
}

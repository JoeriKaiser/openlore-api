import { createHash } from "crypto";
import { encode, decode } from "gpt-tokenizer";
import { db } from "./db";
import { ragChunks, characters, lore } from "./schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { embedText } from "./embeddings";
import { config } from "./env";

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function chunkText(
  text: string
): { chunk: string; tokens: number }[] {
  const ids = encode(text);
  const max = Math.max(50, config.ragChunkTokens);
  const overlap = Math.min(Math.floor(max / 4), config.ragChunkOverlapTokens);
  const out: { chunk: string; tokens: number }[] = [];
  for (let i = 0; i < ids.length; i += max - overlap) {
    const slice = ids.slice(i, i + max);
    if (!slice.length) break;
    const s = decode(slice);
    out.push({ chunk: s, tokens: slice.length });
  }
  if (out.length === 0) out.push({ chunk: text, tokens: ids.length });
  return out;
}

async function upsertChunk(params: {
  userId: string;
  sourceType: "lore" | "character" | "message" | "memory";
  sourceId?: number | null;
  chatId?: number | null;
  characterId?: number | null;
  title?: string | null;
  content: string;
  embedding: number[];
  tokenCount?: number;
}) {
  const hash = sha256(params.content);
  const payload = {
    userId: params.userId,
    sourceType: params.sourceType,
    sourceId: params.sourceId ?? null,
    chatId: params.chatId ?? null,
    characterId: params.characterId ?? null,
    title: params.title ?? null,
    content: params.content,
    embedding: JSON.stringify(params.embedding),
    tokenCount: params.tokenCount ?? null,
    updatedAt: sql`CURRENT_TIMESTAMP`
  };
  await db
    .insert(ragChunks)
    .values({ ...payload, hash })
    .onConflictDoUpdate({
      target: [
        ragChunks.userId,
        ragChunks.sourceType,
        ragChunks.sourceId,
        ragChunks.hash
      ],
      set: payload
    });
}

export async function deleteChunksForSource(
  userId: string,
  sourceType: "lore" | "character" | "message" | "memory",
  sourceId?: number | null
) {
  const conds = [eq(ragChunks.userId, userId), eq(ragChunks.sourceType, sourceType)];
  if (sourceId !== undefined && sourceId !== null) {
    conds.push(eq(ragChunks.sourceId, sourceId));
  }
  await db.delete(ragChunks).where(and(...conds));
}

export async function indexLoreEntry(params: {
  userId: string;
  id: number;
  title: string;
  content: string;
}) {
  const text = `${params.title}\n\n${params.content}`;
  const chunks = chunkText(text);
  for (const c of chunks) {
    const emb = await embedText({ text: c.chunk });
    await upsertChunk({
      userId: params.userId,
      sourceType: "lore",
      sourceId: params.id,
      chatId: null,
      characterId: null,
      title: params.title,
      content: c.chunk,
      embedding: emb,
      tokenCount: c.tokens
    });
  }
}

export async function indexCharacterBio(params: {
  userId: string;
  id: number;
  name: string;
  bio?: string | null;
}) {
  const text = `Character: ${params.name}${params.bio ? `\n\nBio: ${params.bio}` : ""}`;
  const chunks = chunkText(text);
  for (const c of chunks) {
    const emb = await embedText({ text: c.chunk });
    await upsertChunk({
      userId: params.userId,
      sourceType: "character",
      sourceId: params.id,
      characterId: params.id,
      chatId: null,
      title: params.name,
      content: c.chunk,
      embedding: emb,
      tokenCount: c.tokens
    });
  }
}

export async function indexMessageChunk(params: {
  userId: string;
  chatId: number;
  characterId?: number | null;
  role: "user" | "assistant";
  content: string;
}) {
  const prefix = params.role === "user" ? "User" : "Assistant";
  const chunks = chunkText(`${prefix}: ${params.content}`);
  for (const c of chunks) {
    const emb = await embedText({ text: c.chunk });
    await upsertChunk({
      userId: params.userId,
      sourceType: "message",
      sourceId: null,
      chatId: params.chatId,
      characterId: params.characterId ?? null,
      title: null,
      content: c.chunk,
      embedding: emb,
      tokenCount: c.tokens
    });
  }
}

type RetrieveParams = {
  userId: string;
  query: string;
  chatId?: number | null;
  characterId?: number | null;
  loreIds?: number[] | null;
  topK?: number;
};

export async function retrieveRAGContext(p: RetrieveParams) {
  const topK = p.topK ?? config.ragTopK;
  const qEmb = await embedText({ text: p.query });

  const condBase = [eq(ragChunks.userId, p.userId)];

  const loreConds = [...condBase, eq(ragChunks.sourceType, "lore")];
  if (p.loreIds && p.loreIds.length > 0) {
    loreConds.push(inArray(ragChunks.sourceId, p.loreIds));
  }
  const loreRows = await db
    .select({
      id: ragChunks.id,
      title: ragChunks.title,
      content: ragChunks.content,
      embedding: ragChunks.embedding
    })
    .from(ragChunks)
    .where(and(...loreConds));

  const charConds = [...condBase, eq(ragChunks.sourceType, "character")];
  if (p.characterId) {
    charConds.push(eq(ragChunks.characterId, p.characterId));
  }
  const charRows = await db
    .select({
      id: ragChunks.id,
      title: ragChunks.title,
      content: ragChunks.content,
      embedding: ragChunks.embedding
    })
    .from(ragChunks)
    .where(and(...charConds));

  const memConds = [...condBase, eq(ragChunks.sourceType, "message")];
  if (p.chatId) memConds.push(eq(ragChunks.chatId, p.chatId));
  if (p.characterId) memConds.push(eq(ragChunks.characterId, p.characterId));
  const memRows = await db
    .select({
      id: ragChunks.id,
      content: ragChunks.content,
      embedding: ragChunks.embedding
    })
    .from(ragChunks)
    .where(and(...memConds));

  function rank<T extends { embedding: string }>(rows: T[]) {
    return rows
      .map((r) => {
        const v = JSON.parse(r.embedding) as number[];
        return { row: r, score: cosine(qEmb, v) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  const bestLore = rank(loreRows);
  const bestChars = rank(charRows);
  const bestMems = rank(memRows);

  return {
    lore: bestLore.map(({ row, score }) => ({
      title: (row as any).title ?? null,
      content: (row as any).content as string,
      score
    })),
    characters: bestChars.map(({ row, score }) => ({
      title: (row as any).title ?? null,
      content: (row as any).content as string,
      score
    })),
    memories: bestMems.map(({ row, score }) => ({
      content: (row as any).content as string,
      score
    }))
  };
}

export function composeRagSystemPrompt(
  r: Awaited<ReturnType<typeof retrieveRAGContext>>
) {
  const parts: string[] = [];
  if (r.characters.length) {
    const s = r.characters
      .map((c, i) => `(${i + 1}) ${c.title ?? "Character"}: ${c.content}`)
      .join("\n");
    parts.push(`Character profile context:\n${s}`);
  }
  if (r.lore.length) {
    const s = r.lore
      .map((c, i) => `(${i + 1}) ${c.title ?? "Lore"}: ${c.content}`)
      .join("\n");
    parts.push(`Relevant lore:\n${s}`);
  }
  if (r.memories.length) {
    const s = r.memories.map((m, i) => `(${i + 1}) ${m.content}`).join("\n");
    parts.push(`Relevant conversation memory:\n${s}`);
  }
  return parts.join("\n\n");
}

export async function reindexAllForUser(userId: string) {
  const loreRows = await db
    .select({ id: lore.id, title: lore.title, content: lore.content })
    .from(lore)
    .where(eq(lore.userId, userId));
  for (const r of loreRows) {
    await deleteChunksForSource(userId, "lore", r.id);
    await indexLoreEntry({
      userId,
      id: r.id,
      title: r.title,
      content: r.content
    });
  }
  const charRows = await db
    .select({ id: characters.id, name: characters.name, bio: characters.bio })
    .from(characters)
    .where(eq(characters.userId, userId));
  for (const r of charRows) {
    await deleteChunksForSource(userId, "character", r.id);
    await indexCharacterBio({
      userId,
      id: r.id,
      name: r.name,
      bio: r.bio ?? null
    });
  }
}

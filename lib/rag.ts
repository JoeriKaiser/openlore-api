import { createHash } from "crypto";
import { encode, decode } from "gpt-tokenizer";
import { db } from "./db";
import { ragChunks, characters, lore } from "./schema";
import { and, eq, inArray } from "drizzle-orm";
import { embedText } from "./embeddings";
import { config } from "./env";

type SourceType = "lore" | "character" | "message" | "memory";

export const cosine = (a: number[], b: number[]): number => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function chunkText(text: string): { chunk: string; tokens: number }[] {
  const ids = encode(text);
  const max = Math.max(50, config.ragChunkTokens);
  const overlap = Math.min(Math.floor(max / 4), config.ragChunkOverlapTokens);
  const out: { chunk: string; tokens: number }[] = [];
  
  for (let i = 0; i < ids.length; i += max - overlap) {
    const slice = ids.slice(i, i + max);
    if (!slice.length) break;
    out.push({ chunk: decode(slice), tokens: slice.length });
  }
  return out.length ? out : [{ chunk: text, tokens: ids.length }];
}

async function upsertChunk(p: {
  userId: string; sourceType: SourceType; sourceId?: number | null;
  chatId?: number | null; characterId?: number | null; title?: string | null;
  content: string; embedding: number[]; tokenCount?: number;
}) {
  const payload = {
    userId: p.userId, sourceType: p.sourceType, sourceId: p.sourceId ?? null,
    chatId: p.chatId ?? null, characterId: p.characterId ?? null, title: p.title ?? null,
    content: p.content, embedding: JSON.stringify(p.embedding),
    tokenCount: p.tokenCount ?? null, updatedAt: new Date(),
  };
  await db.insert(ragChunks)
    .values({ ...payload, hash: sha256(p.content) })
    .onConflictDoUpdate({
      target: [ragChunks.userId, ragChunks.sourceType, ragChunks.sourceId, ragChunks.hash],
      set: payload,
    });
}

export async function deleteChunksForSource(userId: string, sourceType: SourceType, sourceId?: number | null) {
  const conds = [eq(ragChunks.userId, userId), eq(ragChunks.sourceType, sourceType)];
  if (sourceId != null) conds.push(eq(ragChunks.sourceId, sourceId));
  await db.delete(ragChunks).where(and(...conds));
}

async function indexChunks(userId: string, sourceType: SourceType, sourceId: number, title: string | null, text: string, characterId?: number | null) {
  for (const c of chunkText(text)) {
    const emb = await embedText({ text: c.chunk });
    await upsertChunk({ userId, sourceType, sourceId, characterId, title, content: c.chunk, embedding: emb, tokenCount: c.tokens });
  }
}

export const indexLoreEntry = (p: { userId: string; id: number; title: string; content: string }) =>
  indexChunks(p.userId, "lore", p.id, p.title, `${p.title}\n\n${p.content}`);

export const indexCharacterBio = (p: { userId: string; id: number; name: string; bio?: string | null }) =>
  indexChunks(p.userId, "character", p.id, p.name, `Character: ${p.name}${p.bio ? `\n\nBio: ${p.bio}` : ""}`, p.id);

export async function indexMessageChunk(p: { userId: string; chatId: number; characterId?: number | null; role: "user" | "assistant"; content: string }) {
  const prefix = p.role === "user" ? "User" : "Assistant";
  for (const c of chunkText(`${prefix}: ${p.content}`)) {
    const emb = await embedText({ text: c.chunk });
    await upsertChunk({ userId: p.userId, sourceType: "message", chatId: p.chatId, characterId: p.characterId, content: c.chunk, embedding: emb, tokenCount: c.tokens });
  }
}

export async function retrieveRAGContext(p: { userId: string; query: string; chatId?: number | null; characterId?: number | null; loreIds?: number[] | null; topK?: number }) {
  const topK = p.topK ?? config.ragTopK;
  const qEmb = await embedText({ text: p.query });
  const base = [eq(ragChunks.userId, p.userId)];
  const cols = { id: ragChunks.id, title: ragChunks.title, content: ragChunks.content, embedding: ragChunks.embedding };

  const fetchRows = async (type: SourceType, extra: any[] = []) =>
    db.select(cols).from(ragChunks).where(and(...base, eq(ragChunks.sourceType, type), ...extra));

  const rank = <T extends { embedding: string }>(rows: T[]) =>
    rows.map(r => ({ row: r, score: cosine(qEmb, JSON.parse(r.embedding)) }))
      .sort((a, b) => b.score - a.score).slice(0, topK);

  const loreRows = await fetchRows("lore", p.loreIds?.length ? [inArray(ragChunks.sourceId, p.loreIds)] : []);
  const charRows = await fetchRows("character", p.characterId ? [eq(ragChunks.characterId, p.characterId)] : []);
  const memConds = [p.chatId && eq(ragChunks.chatId, p.chatId), p.characterId && eq(ragChunks.characterId, p.characterId)].filter(Boolean) as any[];
  const memRows = await fetchRows("message", memConds);

  return {
    lore: rank(loreRows).map(({ row, score }) => ({ title: row.title, content: row.content, score })),
    characters: rank(charRows).map(({ row, score }) => ({ title: row.title, content: row.content, score })),
    memories: rank(memRows).map(({ row, score }) => ({ content: row.content, score })),
  };
}

export function composeRagSystemPrompt(r: Awaited<ReturnType<typeof retrieveRAGContext>>) {
  const parts: string[] = [];
  if (r.characters.length) parts.push(`Character profile context:\n${r.characters.map((c, i) => `(${i + 1}) ${c.title ?? "Character"}: ${c.content}`).join("\n")}`);
  if (r.lore.length) parts.push(`Relevant lore:\n${r.lore.map((c, i) => `(${i + 1}) ${c.title ?? "Lore"}: ${c.content}`).join("\n")}`);
  if (r.memories.length) parts.push(`Relevant conversation memory:\n${r.memories.map((m, i) => `(${i + 1}) ${m.content}`).join("\n")}`);
  return parts.join("\n\n");
}

export async function reindexAllForUser(userId: string) {
  const loreRows = await db.select({ id: lore.id, title: lore.title, content: lore.content }).from(lore).where(eq(lore.userId, userId));
  for (const r of loreRows) {
    await deleteChunksForSource(userId, "lore", r.id);
    await indexLoreEntry({ userId, id: r.id, title: r.title, content: r.content });
  }
  const charRows = await db.select({ id: characters.id, name: characters.name, bio: characters.bio }).from(characters).where(eq(characters.userId, userId));
  for (const r of charRows) {
    await deleteChunksForSource(userId, "character", r.id);
    await indexCharacterBio({ userId, id: r.id, name: r.name, bio: r.bio });
  }
}

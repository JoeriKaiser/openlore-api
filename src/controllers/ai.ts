import { db } from "../../lib/db";
import { aiProviderKey, chats, messages, characters as charactersTable, lore as loreTable } from "../../lib/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { badRequest, createSSE, json, readJson, unauthorized } from "../utils/http";
import { getCurrentUser } from "../utils/auth";
import { encryptString, decryptString } from "../../lib/crypto";
import { config } from "../../lib/env";
import { hashPassword } from "better-auth/crypto";
import { retrieveRAGContext, composeRagSystemPrompt, indexMessageChunk, indexLoreEntry } from "../../lib/rag";

const trimTitle = (s: string, len = 80) => {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > len ? t.slice(0, len) + "…" : t;
};

const getUserKey = async (userId: string) => {
  const [row] = await db.select().from(aiProviderKey)
    .where(and(eq(aiProviderKey.userId, userId), eq(aiProviderKey.provider, "openrouter"))).limit(1);
  if (!row) return { key: null, last4: null };
  return { key: decryptString(row.encryptedKey, config.encryptionSecret), last4: row.last4 };
};

const openRouterFetch = (key: string, endpoint: string, body?: object) =>
  fetch(`https://openrouter.ai/api/v1/${endpoint}`, {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
      "http-referer": config.openRouterReferer,
      "x-title": "OpenLore",
    },
    ...(body && { body: JSON.stringify(body) }),
  });

export async function setOpenRouterKey(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const body = await readJson<{ key: string }>(req).catch(() => ({ key: "" }));
  const key = body.key?.trim();
  if (!key) return badRequest("Key is required");

  const [saved] = await db.insert(aiProviderKey)
    .values({
      userId: user.id, provider: "openrouter",
      encryptedKey: encryptString(key, config.encryptionSecret),
      keyHash: await hashPassword(key), last4: key.slice(-4),
    })
    .onConflictDoUpdate({
      target: [aiProviderKey.userId, aiProviderKey.provider],
      set: { encryptedKey: encryptString(key, config.encryptionSecret), keyHash: await hashPassword(key), last4: key.slice(-4), updatedAt: sql`CURRENT_TIMESTAMP` },
    })
    .returning({ id: aiProviderKey.id, last4: aiProviderKey.last4, createdAt: aiProviderKey.createdAt, updatedAt: aiProviderKey.updatedAt });

  return json({ ok: true, ...saved });
}

export async function getOpenRouterKeyStatus(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();
  const [row] = await db.select({ last4: aiProviderKey.last4 }).from(aiProviderKey)
    .where(and(eq(aiProviderKey.userId, user.id), eq(aiProviderKey.provider, "openrouter"))).limit(1);
  return json({ exists: !!row, last4: row?.last4 ?? null });
}

export async function deleteOpenRouterKey(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();
  await db.delete(aiProviderKey).where(and(eq(aiProviderKey.userId, user.id), eq(aiProviderKey.provider, "openrouter")));
  return json({ ok: true });
}

export async function listModels(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();
  
  const { key } = await getUserKey(user.id);
  const res = await openRouterFetch(key ?? "", "models");
  if (!res.ok) return json({ error: "Failed to fetch models", details: await res.text() }, res.status);
  return json(await res.json());
}

async function loadContext(userId: string, characterId?: number | null, loreIds?: number[] | null) {
  const parts: string[] = [];
  
  if (characterId) {
    const [c] = await db.select({ name: charactersTable.name, bio: charactersTable.bio })
      .from(charactersTable).where(and(eq(charactersTable.id, characterId), eq(charactersTable.userId, userId))).limit(1);
    if (c) parts.push(`You are roleplaying as ${c.name}.${c.bio ? `\nBio: ${c.bio}` : ""}`);
  }
  
  if (loreIds?.length) {
    const rows = await db.select({ title: loreTable.title, content: loreTable.content })
      .from(loreTable).where(and(inArray(loreTable.id, loreIds), eq(loreTable.userId, userId)));
    if (rows.length) parts.push(`Relevant lore:\n${rows.map((r, i) => `(${i + 1}) ${r.title}: ${r.content}`).join("\n")}`);
  }
  
  return parts;
}

export async function chatStream(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const body = await readJson<{ chatId?: number; model: string; message: string; system?: string; characterId?: number; loreIds?: number[]; title?: string }>(req).catch(() => ({} as any));
  const model = body.model?.trim();
  const userMessage = body.message?.trim();
  if (!model) return badRequest("model is required");
  if (!userMessage) return badRequest("message is required");

  const { key } = await getUserKey(user.id);
  if (!key) return json({ error: "OpenRouter key not set" }, 400);

  let chatId = body.chatId ?? null;
  let characterId = body.characterId ?? null;

  if (chatId) {
    const [chat] = await db.select({ id: chats.id, model: chats.model, characterId: chats.characterId })
      .from(chats).where(and(eq(chats.id, chatId), eq(chats.userId, user.id))).limit(1);
    if (!chat) return json({ error: "Chat not found" }, 404);
    if (chat.model !== model) await db.update(chats).set({ model, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(chats.id, chatId));
    characterId = characterId ?? chat.characterId;
  } else {
    const [inserted] = await db.insert(chats)
      .values({ userId: user.id, title: trimTitle(body.title?.trim() || userMessage), model, characterId })
      .returning({ id: chats.id });
    chatId = inserted.id;
  }

  await db.insert(messages).values({ chatId, userId: user.id, role: "user", content: userMessage });
  void indexMessageChunk({ userId: user.id, chatId, characterId, role: "user", content: userMessage });

  const history = await db.select({ role: messages.role, content: messages.content })
    .from(messages).where(eq(messages.chatId, chatId)).orderBy(messages.id);

  const systemParts = [body.system?.trim(), ...await loadContext(user.id, characterId, body.loreIds)].filter(Boolean) as string[];
  const rag = await retrieveRAGContext({ userId: user.id, query: userMessage, chatId, characterId, loreIds: body.loreIds, topK: config.ragTopK });
  const ragPrompt = composeRagSystemPrompt(rag);
  if (ragPrompt) systemParts.push(ragPrompt);

  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [];
  if (systemParts.length) chatMessages.push({ role: "system", content: systemParts.join("\n\n") });
  for (const m of history) chatMessages.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content });

  const res = await openRouterFetch(key, "chat/completions", { model, stream: true, messages: chatMessages });
  if (!res.ok || !res.body) return json({ error: "OpenRouter error", details: await res.text().catch(() => res.statusText) }, res.status);

  const { response, write, close } = createSSE();
  let assistantText = "";

  (async () => {
    try {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          for (const line of event.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") break;
            try {
              const delta = JSON.parse(data)?.choices?.[0]?.delta?.content ?? "";
              if (delta) { assistantText += delta; await write("chunk", { delta }); }
            } catch {}
          }
        }
      }

      const [msg] = await db.insert(messages).values({ chatId, userId: user.id, role: "assistant", content: assistantText }).returning({ id: messages.id });
      void indexMessageChunk({ userId: user.id, chatId, characterId, role: "assistant", content: assistantText });
      await db.update(chats).set({ updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(chats.id, chatId));
      await write("done", { chatId, messageId: msg?.id, preview: assistantText.slice(0, 120) });
    } catch (e: any) {
      try { await write("error", { message: e.message }); } catch {}
    } finally {
      try { await close(); } catch {}
    }
  })();

  return response;
}

export async function listChats(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();
  const rows = await db.select({ id: chats.id, title: chats.title, model: chats.model, characterId: chats.characterId, createdAt: chats.createdAt, updatedAt: chats.updatedAt })
    .from(chats).where(eq(chats.userId, user.id)).orderBy(desc(chats.updatedAt));
  return json(rows);
}

export async function getChatMessages(req: Request, idParam: string) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();
  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("Invalid id");

  const [chat] = await db.select({ id: chats.id }).from(chats).where(and(eq(chats.id, id), eq(chats.userId, user.id))).limit(1);
  if (!chat) return json({ error: "Not Found" }, 404);

  const rows = await db.select({ id: messages.id, role: messages.role, content: messages.content, createdAt: messages.createdAt })
    .from(messages).where(eq(messages.chatId, id)).orderBy(messages.id);
  return json(rows);
}

export async function updateChat(req: Request, idParam: string) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();
  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("Invalid id");

  const body = await readJson<{ title?: string; model?: string }>(req).catch(() => ({}));
  const patch: any = {};
  if (body.title !== undefined) patch.title = trimTitle(body.title);
  if (body.model !== undefined) patch.model = body.model;
  if (!Object.keys(patch).length) return badRequest("No fields to update");

  const [updated] = await db.update(chats).set({ ...patch, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(and(eq(chats.id, id), eq(chats.userId, user.id))).returning({ id: chats.id });
  return updated ? json({ ok: true }) : json({ error: "Not Found" }, 404);
}

export async function deleteChat(req: Request, idParam: string) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();
  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("Invalid id");

  const [chat] = await db.select({ id: chats.id }).from(chats).where(and(eq(chats.id, id), eq(chats.userId, user.id))).limit(1);
  if (!chat) return json({ error: "Not Found" }, 404);

  await db.delete(messages).where(eq(messages.chatId, id));
  await db.delete(chats).where(eq(chats.id, id));
  return json({ ok: true });
}

const parseJson = (s: string) => {
  const start = s.indexOf("{"), end = s.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
};

export async function extractLore(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const body = await readJson<{ chatId: number; messageId?: number; model?: string; maxMessages?: number; save?: boolean; title?: string; content?: string }>(req).catch(() => ({} as any));
  const chatId = Number(body.chatId);
  if (!Number.isFinite(chatId)) return badRequest("chatId is required");

  const [chat] = await db.select({ id: chats.id, model: chats.model }).from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, user.id))).limit(1);
  if (!chat) return json({ error: "Chat not found" }, 404);

  const model = body.model?.trim() || chat.model;
  if (!model) return badRequest("model is required");

  const { key } = await getUserKey(user.id);
  if (!key) return json({ error: "OpenRouter key not set" }, 400);

  if (body.title && body.content && body.save) {
    const [saved] = await db.insert(loreTable).values({ title: body.title, content: body.content, userId: user.id }).returning();
    void indexLoreEntry({ userId: user.id, id: saved.id, title: saved.title, content: saved.content });
    return json({ saved });
  }

  const rows = await db.select({ id: messages.id, role: messages.role, content: messages.content })
    .from(messages).where(eq(messages.chatId, chatId)).orderBy(messages.id);
  const maxMsg = Math.max(4, Math.min(30, body.maxMessages ?? 12));
  
  let convo = rows;
  if (body.messageId) {
    const idx = rows.findIndex(r => r.id === body.messageId);
    const start = Math.max(0, idx - Math.floor(maxMsg / 2));
    convo = rows.slice(start, start + maxMsg);
  } else {
    convo = rows.slice(-maxMsg);
  }

  const systemPrompt = `You are an assistant that extracts canonical world lore from a chat.
Given the conversation, identify one important fact, rule, event, or world detail worth storing as lore.
Output ONLY a strict JSON object: { "title": string, "content": string }
- title: concise (< 80 chars), no speaker names.
- content: 1-4 sentences, factual.
- No analysis, preambles, or code fences.`;

  const convoText = convo.map(m => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`).join("\n");
  const res = await openRouterFetch(key, "chat/completions", {
    model, stream: false,
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Conversation:\n\n${convoText}` }],
  });

  if (!res.ok) return json({ error: "Failed to extract lore", details: await res.text() }, res.status);

  const data = await res.json();
  let obj = parseJson(data?.choices?.[0]?.message?.content ?? "");
  if (!obj) {
    const last = [...convo].reverse().find(m => m.role === "assistant")?.content ?? "";
    obj = { title: last.split(/\s+/).slice(0, 8).join(" ") || "Lore Item", content: last || "Important detail." };
  }

  if (body.save) {
    const [saved] = await db.insert(loreTable).values({ title: String(obj.title), content: String(obj.content), userId: user.id }).returning();
    void indexLoreEntry({ userId: user.id, id: saved.id, title: saved.title, content: saved.content });
    return json({ saved });
  }

  return json({ suggestion: { title: String(obj.title ?? "Lore Item"), content: String(obj.content ?? "") } });
}

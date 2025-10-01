import { db } from "../../lib/db";
import {
  aiProviderKey,
  chats,
  messages,
  characters as charactersTable,
  lore as loreTable
} from "../../lib/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { badRequest, createSSE, json, readJson } from "../utils/http";
import { getCurrentUser } from "../utils/auth";
import { encryptString, decryptString } from "../../lib/crypto";
import { config } from "../../lib/env";
import { hashPassword } from "better-auth/crypto";
import {
  retrieveRAGContext,
  composeRagSystemPrompt,
  indexMessageChunk
} from "../../lib/rag";

type SetKeyBody = { key: string };
type ChatStreamBody = {
  chatId?: number;
  model: string;
  message: string;
  system?: string | null;
  characterId?: number | null;
  loreIds?: number[] | null;
  title?: string | null;
};
type UpdateChatBody = { title?: string; model?: string };

function trimTitle(s: string, len = 80) {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > len ? t.slice(0, len) + "…" : t;
}

async function getUserOpenRouterKey(userId: string): Promise<{
  key: string | null;
  last4: string | null;
}> {
  const rows = await db
    .select()
    .from(aiProviderKey)
    .where(and(eq(aiProviderKey.userId, userId), eq(aiProviderKey.provider, "openrouter")))
    .limit(1);
  const row = rows[0];
  if (!row) return { key: null, last4: null };
  const key = decryptString(row.encryptedKey, config.encryptionSecret);
  return { key, last4: row.last4 };
}

export async function setOpenRouterKey(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await readJson<SetKeyBody>(req).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : "Invalid JSON";
    throw new Error(msg);
  });
  const key = (body.key ?? "").trim();
  if (!key) return badRequest("Key is required");

  const last4 = key.slice(-4);
  const encryptedKey = encryptString(key, config.encryptionSecret);
  const keyHash = await hashPassword(key);

  try {
    const [saved] = await db
      .insert(aiProviderKey)
      .values({
        userId: user.id,
        provider: "openrouter",
        encryptedKey,
        keyHash,
        last4
      })
      .onConflictDoUpdate({
        target: [aiProviderKey.userId, aiProviderKey.provider],
        set: {
          encryptedKey,
          keyHash,
          last4,
          updatedAt: sql`CURRENT_TIMESTAMP`
        }
      })
      .returning({
        id: aiProviderKey.id,
        last4: aiProviderKey.last4,
        createdAt: aiProviderKey.createdAt,
        updatedAt: aiProviderKey.updatedAt
      });

    return json({
      ok: true,
      last4: saved!.last4,
      id: saved!.id,
      createdAt: saved!.createdAt,
      updatedAt: saved!.updatedAt
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Database error";
    if (msg.includes("ON CONFLICT")) {
      return json(
        {
          error:
            "Upsert failed. Ensure unique index on (userId, provider) exists."
        },
        500
      );
    }
    return json({ error: "Database error", details: msg }, 500);
  }
}

export async function getOpenRouterKeyStatus(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const rows = await db
    .select({ last4: aiProviderKey.last4 })
    .from(aiProviderKey)
    .where(and(eq(aiProviderKey.userId, user.id), eq(aiProviderKey.provider, "openrouter")))
    .limit(1);

  const row = rows[0];
  return json({ exists: !!row, last4: row?.last4 ?? null });
}

export async function deleteOpenRouterKey(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  await db
    .delete(aiProviderKey)
    .where(and(eq(aiProviderKey.userId, user.id), eq(aiProviderKey.provider, "openrouter")));

  return json({ ok: true });
}

export async function listModels(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { key } = await getUserOpenRouterKey(user.id);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "http-referer": config.openRouterReferer
  };
  if (key) headers.authorization = `Bearer ${key}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers
    });

    if (!res.ok) {
      const text = await res.text();
      return json({ error: "Failed to fetch models", details: text }, res.status);
    }

    const data = await res.json();
    return json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to fetch models";
    return json({ error: "Failed to fetch models", details: msg }, 500);
  }
}

async function loadContextParts(
  userId: string,
  characterId?: number | null,
  loreIds?: number[] | null
) {
  const parts: string[] = [];

  if (characterId && Number.isFinite(characterId)) {
    const rows = await db
      .select({ name: charactersTable.name, bio: charactersTable.bio })
      .from(charactersTable)
      .where(and(eq(charactersTable.id, characterId), eq(charactersTable.userId, userId)))
      .limit(1);
    const c = rows[0];
    if (c) {
      const bio = c.bio ? `\nBio: ${c.bio}` : "";
      parts.push(`You are roleplaying as ${c.name}.${bio}`);
    }
  }

  if (loreIds && loreIds.length > 0) {
    const rows = await db
      .select({ title: loreTable.title, content: loreTable.content })
      .from(loreTable)
      .where(and(inArray(loreTable.id, loreIds), eq(loreTable.userId, userId)));
    if (rows.length > 0) {
      const loreText = rows.map((r, i) => `(${i + 1}) ${r.title}: ${r.content}`).join("\n");
      parts.push(`Relevant lore:\n${loreText}`);
    }
  }

  return parts;
}

export async function chatStream(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  let body: ChatStreamBody;
  try {
    body = await readJson<ChatStreamBody>(req);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid JSON";
    return badRequest(msg);
  }

  const model = (body.model ?? "").trim();
  const userMessage = (body.message ?? "").trim();
  if (!model) return badRequest("model is required");
  if (!userMessage) return badRequest("message is required");

  const { key } = await getUserOpenRouterKey(user.id);
  if (!key) return json({ error: "OpenRouter key not set" }, 400);

  let chatId = body.chatId ?? null;

  if (chatId) {
    const rows = await db
      .select({
        id: chats.id,
        title: chats.title,
        model: chats.model,
        characterId: chats.characterId
      })
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, user.id)))
      .limit(1);
    if (!rows[0]) return json({ error: "Chat not found" }, 404);
    if (rows[0].model !== model) {
      await db
        .update(chats)
        .set({ model, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(and(eq(chats.id, chatId), eq(chats.userId, user.id)));
    }
    if (!body.characterId && rows[0].characterId) {
      body.characterId = rows[0].characterId;
    }
  } else {
    const title =
      body.title && body.title.trim().length > 0
        ? trimTitle(body.title)
        : trimTitle(userMessage);
    const [inserted] = await db
      .insert(chats)
      .values({
        userId: user.id,
        title,
        model,
        characterId: body.characterId ?? null
      })
      .returning({ id: chats.id, title: chats.title });
    chatId = inserted.id;
  }

  await db
    .insert(messages)
    .values({
      chatId: chatId!,
      userId: user.id,
      role: "user",
      content: userMessage
    })
    .returning();
  void indexMessageChunk({
    userId: user.id,
    chatId: chatId!,
    characterId: body.characterId ?? null,
    role: "user",
    content: userMessage
  });

  const historyRows = await db
    .select({
      role: messages.role,
      content: messages.content
    })
    .from(messages)
    .where(eq(messages.chatId, chatId!))
    .orderBy(messages.id);

  const systemParts: string[] = [];
  if (body.system && body.system.trim().length > 0) {
    systemParts.push(body.system.trim());
  }
  const directParts = await loadContextParts(
    user.id,
    body.characterId ?? null,
    body.loreIds ?? null
  );
  if (directParts.length > 0) {
    systemParts.push(...directParts);
  }
  const rag = await retrieveRAGContext({
    userId: user.id,
    query: userMessage,
    chatId: chatId!,
    characterId: body.characterId ?? null,
    loreIds: body.loreIds ?? null,
    topK: config.ragTopK
  });
  const ragPrompt = composeRagSystemPrompt(rag);
  if (ragPrompt.trim().length > 0) systemParts.push(ragPrompt);

  const chatMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [];
  if (systemParts.length > 0) {
    chatMessages.push({ role: "system", content: systemParts.join("\n\n") });
  }
  for (const m of historyRows) {
    const r =
      m.role === "assistant" || m.role === "user"
        ? (m.role as "assistant" | "user")
        : "user";
    chatMessages.push({ role: r, content: m.content });
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${key}`,
    "http-referer": config.openRouterReferer,
    "x-title": "OpenLore Chat"
  };

  const openrouterRes = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        stream: true,
        messages: chatMessages
      })
    }
  );

  if (!openrouterRes.ok || !openrouterRes.body) {
    const text = await openrouterRes.text().catch(() => "");
    return json(
      {
        error: "OpenRouter error",
        details: text || openrouterRes.statusText
      },
      openrouterRes.status
    );
  }

  const { response, write, close } = createSSE();

  let assistantText = "";
  (async () => {
    try {
      const reader = openrouterRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let doneFlag = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const lines = event.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;
            if (dataStr === "[DONE]") {
              doneFlag = true;
              break;
            }
            try {
              const obj = JSON.parse(dataStr) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = obj?.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                assistantText += delta;
                await write("chunk", { delta });
              }
            } catch {}
          }
          if (doneFlag) break;
        }
        if (doneFlag) break;
      }

      const [assistantMsg] = await db
        .insert(messages)
        .values({
          chatId: chatId!,
          userId: user.id,
          role: "assistant",
          content: assistantText
        })
        .returning({ id: messages.id });
      void indexMessageChunk({
        userId: user.id,
        chatId: chatId!,
        characterId: body.characterId ?? null,
        role: "assistant",
        content: assistantText
      });

      await db
        .update(chats)
        .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(and(eq(chats.id, chatId!), eq(chats.userId, user.id)));

      await write("done", {
        chatId,
        messageId: assistantMsg?.id ?? null,
        preview: assistantText.slice(0, 120)
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "stream error";
      try {
        await write("error", { message: msg });
      } catch {}
    } finally {
      try {
        await close();
      } catch {}
    }
  })();

  return response;
}

export async function listChats(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const rows = await db
    .select({
      id: chats.id,
      title: chats.title,
      model: chats.model,
      characterId: chats.characterId,
      createdAt: chats.createdAt,
      updatedAt: chats.updatedAt
    })
    .from(chats)
    .where(eq(chats.userId, user.id))
    .orderBy(desc(chats.updatedAt));

  return json(rows);
}

export async function getChatMessages(req: Request, idParam: string) {
  const user = await getCurrentUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("Invalid id");

  const chatRows = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, id), eq(chats.userId, user.id)))
    .limit(1);
  if (!chatRows[0]) return json({ error: "Not Found" }, 404);

  const rows = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt
    })
    .from(messages)
    .where(eq(messages.chatId, id))
    .orderBy(messages.id);

  return json(rows);
}

export async function updateChat(req: Request, idParam: string) {
  const user = await getCurrentUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("Invalid id");

  let body: UpdateChatBody;
  try {
    body = await readJson<UpdateChatBody>(req);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid JSON";
    return badRequest(msg);
  }

  const patch: Partial<typeof chats.$inferInsert> = {};
  if (body.title !== undefined) patch.title = trimTitle(body.title);
  if (body.model !== undefined) patch.model = body.model;

  if (Object.keys(patch).length === 0) return badRequest("No fields to update");

  const [updated] = await db
    .update(chats)
    .set({ ...patch, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(and(eq(chats.id, id), eq(chats.userId, user.id)))
    .returning({ id: chats.id });

  if (!updated) return json({ error: "Not Found" }, 404);
  return json({ ok: true });
}

export async function deleteChat(req: Request, idParam: string) {
  const user = await getCurrentUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("Invalid id");

  const chatRows = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, id), eq(chats.userId, user.id)))
    .limit(1);
  if (!chatRows[0]) return json({ error: "Not Found" }, 404);

  await db.delete(messages).where(eq(messages.chatId, id));
  await db.delete(chats).where(eq(chats.id, id));

  return json({ ok: true });
}

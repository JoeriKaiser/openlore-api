import { sql, relations } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  boolean,
  timestamp,
  serial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const characters = pgTable(
  "characters",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    bio: text("bio"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: index("characters_name_idx").on(t.name),
    userIdIdx: index("characters_user_id_idx").on(t.userId),
    createdAtIdx: index("characters_created_at_idx").on(t.createdAt),
  })
);

export const lore = pgTable(
  "lore",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    titleIdx: index("lore_title_idx").on(t.title),
    userIdIdx: index("lore_user_id_idx").on(t.userId),
    createdAtIdx: index("lore_created_at_idx").on(t.createdAt),
  })
);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  expiresAt: timestamp("expires_at"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const aiProviderKey = pgTable(
  "ai_provider_key",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    keyHash: text("key_hash").notNull(),
    last4: text("last4").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userProviderUIdx: uniqueIndex("ai_provider_key_user_provider_uidx").on(
      t.userId,
      t.provider
    ),
  })
);

export const chats = pgTable(
  "chats",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    model: text("model").notNull(),
    characterId: integer("character_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("chats_user_idx").on(t.userId),
    updatedAtIdx: index("chats_updated_at_idx").on(t.updatedAt),
  })
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    chatId: integer("chat_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    reasoning: text("reasoning"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    chatIdx: index("messages_chat_idx").on(t.chatId),
    createdAtIdx: index("messages_created_at_idx").on(t.createdAt),
  })
);

export const ragChunks = pgTable(
  "rag_chunks",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceId: integer("source_id"),
    chatId: integer("chat_id"),
    characterId: integer("character_id"),
    title: text("title"),
    content: text("content").notNull(),
    embedding: text("embedding").notNull(),
    tokenCount: integer("token_count"),
    hash: text("hash").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("rag_user_idx").on(t.userId),
    typeIdx: index("rag_type_idx").on(t.sourceType),
    charIdx: index("rag_character_idx").on(t.characterId),
    chatIdx: index("rag_chat_idx").on(t.chatId),
    userSourceHashUIdx: uniqueIndex("rag_user_source_hash_uidx").on(
      t.userId,
      t.sourceType,
      t.sourceId,
      t.hash
    ),
  })
);

export const userRelations = relations(user, ({ many }) => ({
  characters: many(characters),
  lore: many(lore),
  sessions: many(session),
  accounts: many(account),
}));

export const charactersRelations = relations(characters, ({ one }) => ({
  user: one(user, {
    fields: [characters.userId],
    references: [user.id],
  }),
}));

export const loreRelations = relations(lore, ({ one }) => ({
  user: one(user, {
    fields: [lore.userId],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const chatRelations = relations(chats, ({ one, many }) => ({
  user: one(user, {
    fields: [chats.userId],
    references: [user.id],
  }),
  character: one(characters, {
    fields: [chats.characterId],
    references: [characters.id],
  }),
  messages: many(messages),
}));

export const messageRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  user: one(user, {
    fields: [messages.userId],
    references: [user.id],
  }),
}));

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;

export type Lore = typeof lore.$inferSelect;
export type NewLore = typeof lore.$inferInsert;

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;

export type AIProviderKey = typeof aiProviderKey.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type RagChunk = typeof ragChunks.$inferSelect;

import { sql, relations } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const characters = sqliteTable(
  "characters",
  {
    id: integer("id", { mode: "number" }).primaryKey({
      autoIncrement: true,
    }),
    name: text("name").notNull(),
    bio: text("bio"),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    nameIdx: index("characters_name_idx").on(t.name),
    userIdIdx: index("characters_user_id_idx").on(t.userId),
    createdAtIdx: index("characters_created_at_idx").on(t.createdAt),
  })
);

export const lore = sqliteTable(
  "lore",
  {
    id: integer("id", { mode: "number" }).primaryKey({
      autoIncrement: true,
    }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    titleIdx: index("lore_title_idx").on(t.title),
    userIdIdx: index("lore_user_id_idx").on(t.userId),
    createdAtIdx: index("lore_created_at_idx").on(t.createdAt),
  })
);

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  expiresAt: integer("expiresAt", { mode: "timestamp" }),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
});

export const aiProviderKey = sqliteTable(
  "ai_provider_key",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    provider: text("provider").notNull(),
    encryptedKey: text("encryptedKey").notNull(),
    keyHash: text("keyHash").notNull(),
    last4: text("last4").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    userProviderUIdx: uniqueIndex(
      "ai_provider_key_user_provider_uidx"
    ).on(t.userId, t.provider),
  })
);

export const chats = sqliteTable(
  "chats",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    title: text("title"),
    model: text("model").notNull(),
    characterId: integer("characterId", { mode: "number" }),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    userIdx: index("chats_user_idx").on(t.userId),
    updatedAtIdx: index("chats_updated_at_idx").on(t.updatedAt),
  })
);

export const messages = sqliteTable(
  "messages",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    chatId: integer("chatId", { mode: "number" }).notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    chatIdx: index("messages_chat_idx").on(t.chatId),
    createdAtIdx: index("messages_created_at_idx").on(t.createdAt),
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

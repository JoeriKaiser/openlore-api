import { sql, relations } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  index,
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

// Relations
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

/* Types */
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;

export type Lore = typeof lore.$inferSelect;
export type NewLore = typeof lore.$inferInsert;

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
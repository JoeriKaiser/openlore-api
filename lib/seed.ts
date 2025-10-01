import { db } from "./db";
import * as schema from "./schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { reindexAllForUser } from "./rag";

async function seed() {
  console.log("🌱 Starting database seeding...");

  const seedUserId = "seed_user_001";
  const seedUserEmail = "seed@example.com";
  const seedUserPassword = "password123";
  const sessionToken = "seed_session_token_" + Date.now();

  try {
    const hashedPassword = await hashPassword(seedUserPassword);

    const existingSeedUser = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, seedUserId))
      .limit(1);

    let user;
    if (existingSeedUser.length === 0) {
      console.log(`👤 Creating seed user: ${seedUserId}`);
      await db.insert(schema.user).values({
        id: seedUserId,
        name: "Seed User",
        email: seedUserEmail,
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log("✅ Seed user created.");
      user = {
        id: seedUserId,
        name: "Seed User",
        email: seedUserEmail,
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      console.log(`👤 Seed user '${seedUserId}' already exists.`);
      user = existingSeedUser[0];
    }

    const accountId = `acc_${seedUserId}`;
    
    const existingAccountById = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.id, accountId))
      .limit(1);

    const existingAccountByUser = await db
      .select()
      .from(schema.account)
      .where(
        and(
          eq(schema.account.userId, seedUserId),
          eq(schema.account.providerId, "credential")
        )
      )
      .limit(1);

    if (existingAccountById.length === 0 && existingAccountByUser.length === 0) {
      console.log("🔐 Creating credential account for seed user...");
      await db.insert(schema.account).values({
        id: accountId,
        accountId: seedUserEmail,
        providerId: "credential",
        userId: seedUserId,
        accessToken: null,
        refreshToken: null,
        idToken: null,
        expiresAt: null,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✅ Credential account created.`);
      console.log(`   Account ID: ${accountId}`);
      console.log(`   Provider ID: credential`);
      console.log(`   User Email: ${seedUserEmail}`);
    }

    const existingSession = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, seedUserId))
      .limit(1);

    if (existingSession.length === 0) {
      console.log("🔑 Creating session for seed user...");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await db.insert(schema.session).values({
        id: `session_${seedUserId}`,
        token: sessionToken,
        expiresAt: expiresAt,
        ipAddress: "127.0.0.1",
        userAgent: "Seed Script",
        userId: seedUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✅ Session created with token: ${sessionToken}`);
    } else {
      console.log("🔑 Session already exists for seed user.");
      console.log(`   Existing token: ${existingSession[0]?.token}`);
    }

    await db.delete(schema.characters).where(eq(schema.characters.userId, seedUserId));
    await db.delete(schema.lore).where(eq(schema.lore.userId, seedUserId));

    console.log("🎭 Inserting characters...");
    await db.insert(schema.characters).values([
      {
        name: "Aragorn",
        bio: "Ranger of the North, heir of Isildur, and rightful king of Gondor.",
        userId: seedUserId,
      },
      {
        name: "Gandalf",
        bio: "A wise wizard known as Gandalf the Grey, later Gandalf the White.",
        userId: seedUserId,
      },
      {
        name: "Legolas",
        bio: "An elven archer from the Woodland Realm, son of Thranduil.",
        userId: seedUserId,
      },
      {
        name: "Gimli",
        bio: "A dwarf warrior from the Lonely Mountain, son of Glóin.",
        userId: seedUserId,
      },
    ]);
    console.log("✅ Characters inserted.");

    console.log("📚 Inserting lore entries...");
    await db.insert(schema.lore).values([
      {
        title: "The One Ring",
        content: "The master ring created by the Dark Lord Sauron to control all other Rings of Power. It was lost for centuries before being found by Bilbo Baggins.",
        userId: seedUserId,
      },
      {
        title: "The Fellowship",
        content: "A company formed in Rivendell to destroy the One Ring. It consisted of four hobbits, two men, an elf, a dwarf, and a wizard.",
        userId: seedUserId,
      },
      {
        title: "Gondor",
        content: "The greatest kingdom of men in Middle-earth, founded by Elendil and his sons after the fall of Númenor.",
        userId: seedUserId,
      },
      {
        title: "The Shire",
        content: "A peaceful region inhabited by hobbits, located in the northwest of Middle-earth. Known for its green hills and comfortable hobbit-holes.",
        userId: seedUserId,
      },
    ]);
    console.log("✅ Lore entries inserted.");

    console.log("🔁 Reindexing RAG for seed user...");
    await reindexAllForUser(seedUserId);
    console.log("✅ RAG reindex complete for seed user.");

    console.log("\n🎉 Database seeding complete!");
    console.log("\n📋 Seed User Details:");
    console.log(`   Email: ${seedUserEmail}`);
    console.log(`   Password: ${seedUserPassword}`);
    console.log(`   User ID: ${seedUserId}`);
    console.log(`   Session Token: ${sessionToken}`);
    console.log("\n💡 You can now login to your app using the email and password above.");

  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    throw error;
  }
}

seed()
  .then(() => {
    console.log("✨ Seeding process completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("💥 Database seeding failed:", err);
    process.exit(1);
  });

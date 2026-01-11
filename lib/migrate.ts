import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { config } from "./env";

async function runMigrations() {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
  });

  const db = drizzle(pool);

  console.log("🔄 Running migrations...");

  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("✅ Migrations complete!");

  await pool.end();
}

runMigrations().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "./env";

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
});

export const db = drizzle(pool);

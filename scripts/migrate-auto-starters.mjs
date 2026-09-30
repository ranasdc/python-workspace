import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

await pool.query(`
  CREATE TABLE IF NOT EXISTS auto_starter_claim (
    id serial PRIMARY KEY,
    "classId" integer NOT NULL,
    "starterDate" text NOT NULL,
    "claimedAt" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT auto_starter_claim_class_date_unique UNIQUE ("classId", "starterDate")
  )
`)

console.log("auto_starter_claim ready")
await pool.end()

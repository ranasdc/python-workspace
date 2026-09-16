// Applies a .sql file to the Neon database in a single transaction.
//   node --env-file-if-exists=/vercel/share/.env.project scripts/run-sql.mjs scripts/001-entitlements.sql
import { readFileSync } from "node:fs"
import pg from "pg"

const file = process.argv[2]
if (!file) {
  console.error("Usage: run-sql.mjs <path-to-sql>")
  process.exit(1)
}

const sql = readFileSync(file, "utf8")
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

await client.connect()
try {
  await client.query("BEGIN")
  await client.query(sql)
  await client.query("COMMIT")
  console.log(`Applied ${file}`)
} catch (error) {
  await client.query("ROLLBACK")
  console.error(`Failed to apply ${file}:`, error.message)
  process.exitCode = 1
} finally {
  await client.end()
}

import pg from "pg"

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const { rows } = await client.query(`delete from "user" where email = $1 returning id`, [
  "reset-test-v0@example.com",
])
await client.query(`delete from verification where identifier like 'reset-password:%' and "expiresAt" < now() + interval '2 hours' and value = any($1)`, [
  rows.map((r) => r.id),
])
await client.end()
console.log(`[deleted] ${rows.length}`)

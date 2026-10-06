import pg from "pg"

const EMAILS = ["avatar.test.9f3a@school.edu", "avatar.teacher.9f3a@school.edu"]

const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
await c.connect()
const r = await c.query('delete from "user" where email = any($1) returning name, email', [EMAILS])
console.log("deleted:", JSON.stringify(r.rows))
const left = await c.query('select count(*)::int n from class where name = $1', ["Avatar Check Y9"])
console.log("test classes remaining:", left.rows[0].n)
await c.end()

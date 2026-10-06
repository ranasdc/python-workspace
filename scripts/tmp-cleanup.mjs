import pg from "pg"

const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
await c.connect()

const del = await c.query(
  `delete from class where "joinCode" = any($1::text[]) and "teacherId" is null
   returning name, "joinCode"`,
  [["FP75AKFB", "MGY35A4E"]],
)
console.log("[deleted] " + JSON.stringify(del.rows))

const left = await c.query(
  `select count(*)::int n from class c left join "user" u on u.id = c."teacherId"
   where u.id is null`,
)
console.log("[orphans remaining] " + left.rows[0].n)

await c.end()

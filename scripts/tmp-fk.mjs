import pg from "pg"

const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
await c.connect()
const r = await c.query(`
  select tc.table_name, kcu.column_name, rc.delete_rule
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
    join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
   where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name in ('user','class')
   order by rc.delete_rule, tc.table_name`)
const noAction = r.rows.filter((x) => x.delete_rule !== "CASCADE")
console.log("non-cascading FKs:", noAction.length)
noAction.forEach((x) => console.log(" ", x.table_name, x.column_name, x.delete_rule))
console.log("cascading:", r.rows.length - noAction.length)
await c.end()

// Temporary: removes the QA teacher account seeded to verify task/starter reuse.
// Run with --apply to delete; without it, only reports what would be removed.
import pg from "pg"

const EMAIL = "reuse.qa.teacher@example.com"
const apply = process.argv.includes("--apply")
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const fks = await pool.query(
  `select tc.table_name as child, kcu.column_name as col, ccu.table_name as parent, rc.delete_rule
   from information_schema.table_constraints tc
   join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
   join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
   join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
   where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = any($1)
   group by 1,2,3,4 order by parent, child`,
  [["class", "library_file", "library_folder", "daily_starter", "code_file"]],
)
console.table(fks.rows)

const user = await pool.query(`select id from "user" where email = $1`, [EMAIL])
const teacherId = user.rows[0]?.id
if (!teacherId) {
  console.log("No QA user found; nothing to do.")
  await pool.end()
  process.exit(0)
}

const counts = await pool.query(
  `select
     (select count(*) from class where teacher_id = $1) as classes,
     (select count(*) from library_folder where teacher_id = $1) as folders,
     (select count(*) from library_file where teacher_id = $1) as files,
     (select count(*) from file_task where library_file_id in (select id from library_file where teacher_id = $1)) as tasks,
     (select count(*) from daily_starter where class_id in (select id from class where teacher_id = $1)) as starters`,
  [teacherId],
)
console.log("QA footprint:", counts.rows[0])

if (!apply) {
  console.log("Dry run only. Re-run with --apply to delete.")
  await pool.end()
  process.exit(0)
}

const client = await pool.connect()
try {
  await client.query("begin")
  await client.query(
    `delete from file_task where library_file_id in (select id from library_file where teacher_id = $1)
       or code_file_id in (select id from code_file where class_id in (select id from class where teacher_id = $1))`,
    [teacherId],
  )
  await client.query(
    `delete from daily_starter where class_id in (select id from class where teacher_id = $1)`,
    [teacherId],
  )
  await client.query(
    `delete from code_file where class_id in (select id from class where teacher_id = $1)`,
    [teacherId],
  )
  await client.query(`delete from library_file where teacher_id = $1`, [teacherId])
  await client.query(`delete from library_folder where teacher_id = $1`, [teacherId])
  await client.query(`delete from class where teacher_id = $1`, [teacherId])
  await client.query(`delete from "user" where id = $1`, [teacherId])
  await client.query("commit")
  console.log("QA teacher and seeded data removed.")
} catch (error) {
  await client.query("rollback")
  throw error
} finally {
  client.release()
}

await pool.end()

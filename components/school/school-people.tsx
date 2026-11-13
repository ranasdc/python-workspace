"use client"

import { useId, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, MoreHorizontal, Search, UserMinus } from "lucide-react"
import { toast } from "sonner"

import { removeSchoolMember } from "@/app/actions/schools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  matchesPerson,
  type SchoolRoster,
  type SchoolStudent,
  type SchoolTeacher,
} from "@/lib/school-roster"

/** Above this many classes they start folded, so the page stays scannable. */
const OPEN_BY_DEFAULT_LIMIT = 3

const UNASSIGNED = "unassigned"

function plural(count: number, noun: string, many = `${noun}s`) {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? noun : many}`
}

function SearchField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        aria-label={label}
        className="pl-8"
      />
    </div>
  )
}

/**
 * The people of a school, for its administrator.
 *
 * Teachers and students are two sections because they are two relationships.
 * A teacher belongs to the school — they are listed once, from their
 * membership, whether they teach five classes or none. A student belongs to
 * classes — they are listed under each one they are enrolled in.
 */
export function SchoolPeople({ schoolId, roster }: { schoolId: number; roster: SchoolRoster }) {
  const router = useRouter()
  const [removing, setRemoving] = useState<string | null>(null)

  async function removeFromSchool(userId: string, name: string) {
    if (removing) return
    setRemoving(userId)
    try {
      await removeSchoolMember(schoolId, userId)
      toast.success(`${name} was removed from the school`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setRemoving(null)
    }
  }

  return (
    <>
      <TeachersSection
        teachers={roster.teachers}
        removing={removing}
        onRemove={removeFromSchool}
      />
      <ClassesSection roster={roster} removing={removing} onRemove={removeFromSchool} />
    </>
  )
}

function TeachersSection({
  teachers,
  removing,
  onRemove,
}: {
  teachers: SchoolTeacher[]
  removing: string | null
  onRemove: (userId: string, name: string) => void
}) {
  const headingId = useId()
  const [query, setQuery] = useState("")
  const visible = useMemo(
    () => teachers.filter((teacher) => matchesPerson(teacher, query)),
    [teachers, query],
  )

  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-lg font-semibold">
            School Teachers
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Everyone who has joined this school as a teacher, whether or not they have a class yet.
          </p>
        </div>
        <Badge variant="secondary">{plural(teachers.length, "teacher")}</Badge>
      </div>

      <div className="mt-4 flex">
        <SearchField
          value={query}
          onChange={setQuery}
          label="Search teachers by name or email"
        />
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {teachers.length === 0
            ? "No teachers have joined this school yet."
            : "No teachers match your search."}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {visible.map((teacher) => (
            <li key={teacher.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium">{teacher.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{teacher.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{teacher.isAdmin ? "Administrator" : "Teacher"}</Badge>
                <Badge variant="outline">Active</Badge>
                <span className="text-xs text-muted-foreground">
                  {teacher.classCount === 0
                    ? "No classes yet"
                    : plural(teacher.classCount, "class", "classes")}
                </span>
              </div>
              {!teacher.isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={removing !== null}
                  onClick={() => onRemove(teacher.id, teacher.displayName)}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type Group = {
  key: string
  name: string
  caption: string | null
  students: SchoolStudent[]
}

function ClassesSection({
  roster,
  removing,
  onRemove,
}: {
  roster: SchoolRoster
  removing: string | null
  onRemove: (userId: string, name: string) => void
}) {
  const headingId = useId()
  const filterId = useId()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all")

  const groups = useMemo<Group[]>(() => {
    const classGroups: Group[] = roster.classes.map((cls) => ({
      key: `class-${cls.id}`,
      name: cls.name,
      caption: cls.teacher
        ? `Teacher: ${cls.teacher.name}${cls.teacher.isSchoolMember ? "" : " (no longer a member)"}`
        : "No teacher assigned",
      students: cls.students,
    }))
    // Students who hold a seat but are in no class yet. Listed last and apart,
    // so they stay visible — and removable — without posing as a class.
    if (roster.unassignedStudents.length > 0) {
      classGroups.push({
        key: UNASSIGNED,
        name: "Not in a class yet",
        caption: "Joined the school but not enrolled in any of its classes",
        students: roster.unassignedStudents,
      })
    }
    return classGroups
  }, [roster])

  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(
    () =>
      new Set(groups.length <= OPEN_BY_DEFAULT_LIMIT ? groups.map((group) => group.key) : []),
  )

  const searching = query.trim().length > 0
  const visibleGroups = groups
    .filter((group) => filter === "all" || group.key === filter)
    .map((group) => ({
      ...group,
      matches: group.students.filter((student) => matchesPerson(student, query)),
    }))
    // A class with nobody matching is noise while searching, but an empty
    // class is still a class when simply browsing.
    .filter((group) => !searching || group.matches.length > 0)

  function toggle(key: string) {
    setOpenKeys((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-lg font-semibold">
            Classes and Students
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Each class in this school with the students enrolled in it. A student in more than one
            class appears under each, and is counted once in the total.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{plural(roster.totals.classes, "class", "classes")}</Badge>
          <Badge variant="secondary">{plural(roster.totals.uniqueStudents, "student")}</Badge>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <SearchField value={query} onChange={setQuery} label="Search students by name or email" />
        <div className="sm:w-56">
          <label htmlFor={filterId} className="sr-only">
            Filter by class
          </label>
          <select
            id={filterId}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
          >
            <option value="all">All classes</option>
            {groups.map((group) => (
              <option key={group.key} value={group.key}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {groups.length === 0
            ? "No classes have been created in this school yet."
            : "No students match your search."}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {visibleGroups.map((group) => {
            // A search opens every class it finds someone in; otherwise the
            // administrator's own choice stands.
            const open = searching || openKeys.has(group.key)
            const panelId = `${headingId}-${group.key}`
            return (
              <div key={group.key} className="rounded-md border border-border">
                <h3>
                  <button
                    type="button"
                    onClick={() => toggle(group.key)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    disabled={searching}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:hover:bg-transparent"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{group.name}</span>
                      {group.caption && (
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {group.caption}
                        </span>
                      )}
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      {searching
                        ? `${group.matches.length} of ${group.students.length}`
                        : plural(group.students.length, "student")}
                    </Badge>
                  </button>
                </h3>
                {open && (
                  <div id={panelId} className="border-t border-border">
                    {group.matches.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-muted-foreground">
                        No students are enrolled in this class yet.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {group.matches.map((student) => (
                          <li key={student.id} className="flex items-center gap-3 px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{student.displayName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {student.email}
                              </p>
                            </div>
                            {student.isSchoolMember && (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className="shrink-0 text-muted-foreground"
                                      disabled={removing !== null}
                                    />
                                  }
                                  aria-label={`Actions for ${student.displayName}`}
                                >
                                  <MoreHorizontal />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => onRemove(student.id, student.displayName)}
                                  >
                                    <UserMinus />
                                    Remove from school
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

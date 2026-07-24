import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  unique,
} from "drizzle-orm/pg-core"

// ---------- Better Auth tables ----------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("student"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// ---------- App tables ----------
export const classes = pgTable("class", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  joinCode: text("joinCode").notNull().unique(),
  teacherId: text("teacherId").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const enrollments = pgTable(
  "enrollment",
  {
    id: serial("id").primaryKey(),
    classId: integer("classId").notNull(),
    studentId: text("studentId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    uniqEnrollment: unique().on(t.classId, t.studentId),
  }),
)

export const codeFiles = pgTable("code_file", {
  id: serial("id").primaryKey(),
  classId: integer("classId").notNull(),
  studentId: text("studentId").notNull(),
  name: text("name").notNull(),
  content: text("content").notNull().default(""),
  // Teacher marking: "unmarked" | "done"
  status: text("status").notNull().default("unmarked"),
  markedAt: timestamp("markedAt"),
  // True when a teacher distributed this file to the student.
  assignedByTeacher: boolean("assignedByTeacher").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// Teacher comments left on a specific student file.
export const fileComments = pgTable("file_comment", {
  id: serial("id").primaryKey(),
  fileId: integer("fileId").notNull(),
  teacherId: text("teacherId").notNull(),
  teacherName: text("teacherName").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// A teacher's private library of reusable folders...
export const libraryFolders = pgTable("library_folder", {
  id: serial("id").primaryKey(),
  teacherId: text("teacherId").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// ...and the files inside them (folderId null = library root).
export const libraryFiles = pgTable("library_file", {
  id: serial("id").primaryKey(),
  teacherId: text("teacherId").notNull(),
  folderId: integer("folderId"),
  name: text("name").notNull(),
  content: text("content").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

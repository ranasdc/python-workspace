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
  // Freemium model for individual students
  accountType: text("accountType"), // "class" | "individual"
  isFirstLogin: boolean("isFirstLogin").notNull().default(true),
  subscriptionStatus: text("subscriptionStatus").default("free"), // "free" | "monthly" | "yearly"
  createdFilesCount: integer("createdFilesCount").notNull().default(0),
  createdFoldersCount: integer("createdFoldersCount").notNull().default(0),
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
  // Set when the class belongs to a school; null for standalone teachers.
  schoolId: integer("schoolId"),
  // Personal workspaces are auto-created for individual students. They must
  // never be joinable by anyone else even though they carry a join code.
  isPersonal: boolean("isPersonal").notNull().default(false),
  // Lets a teacher disable or rotate a code without deleting the class.
  joinCodeActive: boolean("joinCodeActive").notNull().default(true),
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

// Folders that organize a student's files within a class. A folder can be
// created by the student or delivered by a teacher (assignedByTeacher).
export const studentFolders = pgTable("student_folder", {
  id: serial("id").primaryKey(),
  classId: integer("classId").notNull(),
  studentId: text("studentId").notNull(),
  name: text("name").notNull(),
  assignedByTeacher: boolean("assignedByTeacher").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const codeFiles = pgTable("code_file", {
  id: serial("id").primaryKey(),
  classId: integer("classId").notNull(),
  studentId: text("studentId").notNull(),
  // Null = file lives at the class root (outside any folder).
  folderId: integer("folderId"),
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

// ---------- Schools, membership & entitlements ----------

export const schools = pgTable("school", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: text("createdBy")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// Membership is the ONLY way a user is attached to a school. Roles here are
// independent of user.role so a school can promote an admin without granting
// global privileges. "school_admin" is never self-registerable.
export const schoolMembers = pgTable(
  "school_member",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("schoolId")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("student"), // student | teacher | school_admin
    status: text("status").notNull().default("active"), // active | removed
    joinedAt: timestamp("joinedAt").notNull().defaultNow(),
  },
  (t) => ({
    uniqMember: unique().on(t.schoolId, t.userId),
  }),
)

export const inviteCodes = pgTable("invite_code", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  // Role granted when this code is redeemed.
  role: text("role").notNull().default("student"), // student | teacher
  maxUses: integer("maxUses"), // null = unlimited
  usedCount: integer("usedCount").notNull().default(0),
  expiresAt: timestamp("expiresAt"),
  active: boolean("active").notNull().default(true),
  createdBy: text("createdBy")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Individual paid plans (Student Pro / Teacher Pro). One row per user.
export const subscriptions = pgTable("subscription", {
  id: serial("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(), // student_pro | teacher_pro
  status: text("status").notNull().default("inactive"),
  interval: text("interval"), // month | year
  stripeCustomerId: text("stripeCustomerId"),
  stripeSubscriptionId: text("stripeSubscriptionId").unique(),
  stripePriceId: text("stripePriceId"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// School-wide plans. Seat limits are stored per school so they stay
// configurable independently of the tier defaults.
export const schoolSubscriptions = pgTable("school_subscription", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId")
    .notNull()
    .unique()
    .references(() => schools.id, { onDelete: "cascade" }),
  tier: text("tier").notNull(), // school_small | school_medium | school_large
  status: text("status").notNull().default("inactive"),
  teacherSeatLimit: integer("teacherSeatLimit"),
  studentSeatLimit: integer("studentSeatLimit"),
  stripeCustomerId: text("stripeCustomerId"),
  stripeSubscriptionId: text("stripeSubscriptionId").unique(),
  stripePriceId: text("stripePriceId"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// Processed Stripe events, so webhook retries can never double-apply.
export const stripeEvents = pgTable("stripe_event", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processedAt").notNull().defaultNow(),
})

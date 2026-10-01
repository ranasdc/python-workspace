"use client"

import Link from "next/link"
import { Building2, GraduationCap, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { AccountProfile } from "@/lib/account"

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/**
 * Where this person belongs: their school, and the classes they teach or are
 * enrolled in. Each student class names its teacher and that teacher's school,
 * so a pupil can always tell who set the work in front of them.
 */
export function MembershipPanel({ profile }: { profile: AccountProfile }) {
  const { membership, entitlement, teacherClasses, studentClasses } = profile

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>School</CardTitle>
          <CardDescription>
            {membership
              ? "You were added by your school administrator."
              : "You are using mycodepad independently."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membership ? (
            <dl className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Name</dt>
                <dd className="text-sm font-medium">{membership.schoolName}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Your role</dt>
                <dd>
                  <Badge variant="secondary">{profile.roleLabel}</Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Joined</dt>
                <dd className="text-sm font-medium">{formatDate(membership.joinedAt)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground text-pretty">
              {entitlement.isTeacher
                ? "If your school has a plan, ask your administrator for a teacher code to join it."
                : "Join a class with the code from your teacher to be linked to their school."}
            </p>
          )}
        </CardContent>
        {membership?.isAdmin && (
          <CardFooter>
            <Link href="/school" className={buttonVariants({ variant: "outline" })}>
              <Building2 data-icon="inline-start" />
              Manage school
            </Link>
          </CardFooter>
        )}
      </Card>

      {entitlement.isTeacher ? (
        <Card>
          <CardHeader>
            <CardTitle>Your classes</CardTitle>
            <CardDescription>
              {teacherClasses.length === 0
                ? "The classes you run, and how many students are in each."
                : teacherClasses.length === 1
                  ? "You teach 1 class."
                  : `You teach ${teacherClasses.length} classes.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teacherClasses.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>No classes yet</EmptyTitle>
                  <EmptyDescription>
                    Create your first class from your dashboard.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {teacherClasses.map((cls) => (
                  <li
                    key={cls.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5"
                  >
                    <span className="truncate text-sm font-medium">{cls.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {cls.studentCount === 1
                        ? "1 student"
                        : `${cls.studentCount} students`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your classes</CardTitle>
            <CardDescription>
              The classes you have joined with a class code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {studentClasses.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <GraduationCap />
                  </EmptyMedia>
                  <EmptyTitle>No classes yet</EmptyTitle>
                  <EmptyDescription>
                    Ask your teacher for a class code to join their class.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {studentClasses.map((cls) => (
                  <li
                    key={cls.id}
                    className="flex flex-col gap-0.5 rounded-lg border border-border px-3 py-2.5"
                  >
                    <span className="text-sm font-medium">{cls.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {cls.teacherName}
                      {cls.schoolName ? ` · ${cls.schoolName}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import type React from "react"
import { Code2, Play, FolderTree, GraduationCap } from "lucide-react"

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Brand / feature panel */}
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2 text-sidebar-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Code2 className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">PyClass</span>
        </div>

        <div className="max-w-sm">
          <h2 className="text-3xl font-semibold leading-tight text-balance text-sidebar-foreground">
            Teach and learn Python in one clean workspace.
          </h2>
          <ul className="mt-8 flex flex-col gap-5">
            <Feature
              icon={<Play className="h-4 w-4" />}
              title="Run Python in the browser"
              desc="Students execute code instantly with no setup, powered by Pyodide."
            />
            <Feature
              icon={<FolderTree className="h-4 w-4" />}
              title="Organized submissions"
              desc="Every file appears in the teacher's class → student → file tree."
            />
            <Feature
              icon={<GraduationCap className="h-4 w-4" />}
              title="Simple class join codes"
              desc="Teachers share a code, students join in seconds."
            />
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">Built for classrooms of every size.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">{children}</div>
    </div>
  )
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <p className="font-medium text-sidebar-foreground">{title}</p>
        <p className="text-sm text-muted-foreground text-pretty">{desc}</p>
      </div>
    </li>
  )
}

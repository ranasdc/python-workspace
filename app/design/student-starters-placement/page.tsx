import type { ReactNode } from "react"
import { ArrowRight, CheckCircle2, FileCode2, LogOut, Play, Plus, Timer, Users, X, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

export const metadata = { title: "Student Daily Starter placement options", robots: { index: false } }

const files = ["main.py", "loops.py", "quiz.py"]

function Header({ withLink = false }: { withLink?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
      <div className="leading-tight">
        <span className="block text-sm font-semibold">mycodepad</span>
        <span className="block text-xs text-muted-foreground">Student workspace</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {withLink && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Zap className="h-4 w-4 text-primary" /> Daily Starter
          </span>
        )}
        <span className="font-medium">Alex Student</span>
        <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </span>
      </div>
    </div>
  )
}

function ClassList() {
  return (
    <div className="border-b border-border p-3">
      <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Class</p>
      <div className="flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-2 text-sm font-medium text-primary">
        <Users className="h-4 w-4" /> Year 9
      </div>
      <p className="mt-1 flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-muted-foreground">
        <Plus className="h-4 w-4" /> Join another class
      </p>
    </div>
  )
}

function FileList() {
  return (
    <div className="flex flex-col gap-0.5 p-3">
      <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Files</p>
      {files.map((f, i) => (
        <div
          key={f}
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm",
            i === 0 ? "bg-muted font-medium" : "text-muted-foreground",
          )}
        >
          <FileCode2 className="h-4 w-4" /> {f}
        </div>
      ))}
    </div>
  )
}

function Editor({ top }: { top?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {top}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium">main.py</span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
          <Play className="h-3.5 w-3.5" /> Run code
        </span>
      </div>
      <div className="grid flex-1 grid-cols-2">
        <pre className="border-r border-border p-4 font-mono text-xs leading-relaxed text-muted-foreground">
          {"for i in range(5):\n    print(i)"}
        </pre>
        <pre className="bg-muted/30 p-4 font-mono text-xs text-muted-foreground">{"0\n1\n2\n3\n4"}</pre>
      </div>
    </div>
  )
}

function StartButton({ small = false }: { small?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-primary font-medium text-primary-foreground",
        small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
      )}
    >
      Start <ArrowRight className="h-3.5 w-3.5" />
    </span>
  )
}

function Frame({
  id,
  title,
  pitch,
  pros,
  cons,
  children,
}: {
  id: string
  title: string
  pitch: string
  pros: string[]
  cons: string[]
  children: ReactNode
}) {
  return (
    <section id={`option-${id.toLowerCase()}`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">
          Option {id}: {title}
        </h2>
        <p className="text-sm text-muted-foreground">{pitch}</p>
      </div>
      <div className="flex h-[380px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        {children}
      </div>
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <ul className="flex flex-col gap-1">
          {pros.map((p) => (
            <li key={p} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-chart-3" /> {p}
            </li>
          ))}
        </ul>
        <ul className="flex flex-col gap-1 text-muted-foreground">
          {cons.map((c) => (
            <li key={c} className="flex gap-2">
              <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> {c}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default function StudentStartersPlacementPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-14 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Design preview</p>
        <h1 className="text-balance text-3xl font-semibold">Where should students find the Daily Starter?</h1>
        <p className="text-pretty text-muted-foreground">
          Today it is a small text link in the header, which is easy to miss. Three alternatives below, all
          using mock data.
        </p>
      </header>

      <Frame
        id="A"
        title="Today card in the sidebar"
        pitch="A compact card under the class picker shows today's starter for the selected class, with its status and a Start button."
        pros={[
          "Always visible next to the class it belongs to",
          "Shows status at a glance: new, in progress, done",
          "Header stays clean",
        ]}
        cons={["Takes a little vertical space from the file list", "History needs a small 'See all' link"]}
      >
        <Header />
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
            <ClassList />
            <div className="border-b border-border p-3">
              <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Zap className="h-3.5 w-3.5" /> Today&apos;s starter
                  </span>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                    New
                  </span>
                </div>
                <p className="text-sm font-medium">for loops starter</p>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                    <Timer className="h-3.5 w-3.5" /> 5 Qs · 5 min
                  </span>
                  <StartButton small />
                </div>
              </div>
              <p className="mt-2 px-1 text-xs text-muted-foreground">See past starters</p>
            </div>
            <FileList />
          </aside>
          <Editor />
        </div>
      </Frame>

      <Frame
        id="B"
        title="Banner above the editor"
        pitch="When a starter is waiting, a slim banner appears at the top of the workspace. It disappears once the starter is completed."
        pros={[
          "Hardest to miss at the start of a lesson",
          "Zero space used when there is nothing to do",
        ]}
        cons={[
          "Pushes the editor down while visible",
          "No permanent home for past starters (needs a secondary link)",
        ]}
      >
        <Header />
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
            <ClassList />
            <FileList />
          </aside>
          <Editor
            top={
              <div className="flex items-center justify-between gap-3 border-b border-primary/30 bg-primary/10 px-4 py-2.5">
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Zap className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="font-medium">Daily Starter ready:</span>{" "}
                    <span className="text-muted-foreground">for loops starter · 5 questions · 5 min</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <StartButton small />
                </div>
              </div>
            }
          />
        </div>
      </Frame>

      <Frame
        id="C"
        title="Files | Starters tabs in the sidebar"
        pitch="Mirrors the teacher layout: under the class picker, a tab bar switches the sidebar between the class's files and its starters (today plus history)."
        pros={[
          "Consistent with the teacher dashboard you approved",
          "Room for today's starter and full history in one place",
          "Badge dot signals a new starter without shouting",
        ]}
        cons={["One extra click compared with A or B", "Starter is hidden while the Files tab is open"]}
      >
        <Header />
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
            <ClassList />
            <div className="flex gap-1 border-b border-border px-3 pt-2">
              <span className="border-b-2 border-transparent px-2.5 pb-2 text-sm text-muted-foreground">Files</span>
              <span className="relative inline-flex items-center gap-1.5 border-b-2 border-primary px-2.5 pb-2 text-sm font-medium text-primary">
                <Zap className="h-3.5 w-3.5" /> Starters
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              </span>
            </div>
            <div className="flex flex-col gap-2 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Today</p>
              <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2">
                <span className="text-sm font-medium">for loops starter</span>
                <StartButton small />
              </div>
              <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Earlier</p>
              {["Variables recap · 4/5", "If statements · 5/5"].map((s) => (
                <div key={s} className="flex items-center gap-2 px-2.5 py-1 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-chart-3" /> {s}
                </div>
              ))}
            </div>
          </aside>
          <Editor />
        </div>
      </Frame>
    </main>
  )
}

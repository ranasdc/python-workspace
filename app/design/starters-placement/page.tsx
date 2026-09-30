import type { ReactNode } from "react"
import { BookOpen, Library, Zap, Plus, LogOut, Presentation, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export const metadata = { title: "Starters placement options", robots: { index: false } }

function Header({ nav }: { nav?: ReactNode }) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">mycodepad</p>
            <p className="text-xs text-muted-foreground">Teacher Workspace</p>
          </div>
        </div>
        {nav}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span>Sam Dev Chauhan</span>
        <span className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5">
          <LogOut className="h-4 w-4" /> Sign out
        </span>
      </div>
    </header>
  )
}

function Tab({ icon: Icon, label, active }: { icon: typeof BookOpen; label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </span>
  )
}

function ClassList() {
  return (
    <>
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Your classes</span>
        <Plus className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="px-2">
        <div className="rounded-md bg-primary/10 px-2.5 py-2">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <BookOpen className="h-4 w-4" /> Year 9
          </p>
          <p className="pl-6 text-xs text-muted-foreground">1 student</p>
        </div>
      </div>
    </>
  )
}

function StartersPanel() {
  return (
    <div className="flex flex-col gap-4 p-8">
      <div>
        <h2 className="text-2xl font-semibold">Daily Starters</h2>
        <p className="text-sm text-muted-foreground">Five quick questions to open every lesson.</p>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <div>
          <p className="font-medium">for loops starter</p>
          <p className="text-xs text-muted-foreground">2026-09-30 · 5 min · 1/1 submitted</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          <Presentation className="h-4 w-4" /> Present
        </span>
      </div>
    </div>
  )
}

function Frame({ id, title, pitch, children }: { id: string; title: string; pitch: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{pitch}</p>
      </div>
      <div className="flex h-[420px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        {children}
      </div>
    </section>
  )
}

export default function Page() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Where should Starters live?</h1>
        <p className="text-sm text-muted-foreground">Temporary preview with mock data. Pick A, B or C.</p>
      </header>

      <Frame
        id="a"
        title="A. Top navigation in the header (recommended)"
        pitch="Workspace and Daily Starters become the two top-level sections in the header. The sidebar goes back to just Classes and Library with room to breathe, and Starters gets the whole page."
      >
        <Header
          nav={
            <nav className="flex gap-1 text-sm font-medium">
              <span className="rounded-md px-3 py-1.5 text-muted-foreground">Workspace</span>
              <span className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-primary">
                <Zap className="h-4 w-4" /> Daily Starters
              </span>
            </nav>
          }
        />
        <div className="flex-1">
          <StartersPanel />
        </div>
      </Frame>

      <Frame
        id="b"
        title="B. Feature card at the bottom of the sidebar"
        pitch="Classes and Library stay as a two-tab switch. Starters becomes a distinct card pinned to the sidebar bottom, showing today's starter with a one-click Present."
      >
        <Header />
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-64 flex-col border-r border-border bg-sidebar">
            <div className="flex gap-1 border-b border-border p-2">
              <Tab icon={BookOpen} label="Classes" active />
              <Tab icon={Library} label="Library" />
            </div>
            <ClassList />
            <div className="mt-auto p-3">
              <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                  <Zap className="h-4 w-4" /> Daily Starters
                </p>
                <p className="text-xs text-muted-foreground">Today: for loops starter</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-md bg-primary px-2 py-1 text-primary-foreground">Present</span>
                  <span className="flex items-center text-muted-foreground">
                    Manage <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>
          </aside>
          <div className="flex-1 p-8 text-sm text-muted-foreground">Year 9 class view…</div>
        </div>
      </Frame>

      <Frame
        id="c"
        title="C. Inside each class, as a tab"
        pitch="Starters are always tied to a class, so they sit next to the class's tasks: Tasks | Starters. Nothing extra in the sidebar; teachers find starters where they already manage a class."
      >
        <Header />
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-64 flex-col border-r border-border bg-sidebar">
            <div className="flex gap-1 border-b border-border p-2">
              <Tab icon={BookOpen} label="Classes" active />
              <Tab icon={Library} label="Library" />
            </div>
            <ClassList />
          </aside>
          <div className="flex flex-1 flex-col">
            <div className="flex items-end gap-6 border-b border-border px-8 pt-6">
              <h2 className="pb-3 text-xl font-semibold">Year 9</h2>
              <span className="pb-3 text-sm text-muted-foreground">Tasks</span>
              <span className="flex items-center gap-1.5 border-b-2 border-primary pb-3 text-sm font-medium text-primary">
                <Zap className="h-4 w-4" /> Starters
              </span>
              <span className="pb-3 text-sm text-muted-foreground">Students</span>
            </div>
            <StartersPanel />
          </div>
        </div>
      </Frame>
    </main>
  )
}

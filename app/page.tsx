import Link from "next/link"
import Image from "next/image"
import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Code2, Play, FolderTree, GraduationCap, BookOpen, ArrowRight } from "lucide-react"

export default async function HomePage() {
  const user = await getSessionUser()
  if (user) redirect("/dashboard")

  return (
    <main className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Code2 className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">PyClass</span>
        </div>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/sign-in" />} nativeButton={false} variant="ghost">
            Sign in
          </Button>
          <Button render={<Link href="/sign-up" />} nativeButton={false}>
            Get started
          </Button>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Play className="h-3 w-3 text-primary" />
          Runs Python right in the browser
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl">
          A Python IDE built for teachers and students
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
          Students write and run Python in a clean editor. Their code flows straight to the
          teacher&apos;s dashboard, neatly organized by class, student, and file.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button render={<Link href="/sign-up" />} nativeButton={false} size="lg">
            Start coding <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <Button render={<Link href="/sign-in" />} nativeButton={false} size="lg" variant="outline">
            I already have an account
          </Button>
        </div>

        <div className="relative mt-16 w-full">
          {/* Soft color glows so the frosted-glass blur has something to work with */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 -z-10 overflow-hidden"
          >
            <div className="absolute left-[8%] top-0 h-48 w-48 rounded-full bg-primary/30 blur-3xl" />
            <div className="absolute left-1/2 top-10 h-56 w-56 -translate-x-1/2 rounded-full bg-accent/40 blur-3xl" />
            <div className="absolute right-[8%] bottom-0 h-48 w-48 rounded-full bg-chart-2/30 blur-3xl" />
          </div>
          <div className="grid w-full gap-4 sm:grid-cols-3">
          <Card
            image="/images/students.png"
            imageAlt="Illustration of a student writing Python code on a laptop"
            icon={<BookOpen className="h-5 w-5" />}
            title="For students"
            desc="Join a class with a code, write Python, and run it instantly. Your work saves automatically."
          />
          <Card
            image="/images/teachers.png"
            imageAlt="Illustration of a teacher reviewing student code on a dashboard"
            icon={<GraduationCap className="h-5 w-5" />}
            title="For teachers"
            desc="Create classes, share join codes, and browse every student's files in a structured tree."
          />
          <Card
            image="/images/organized.png"
            imageAlt="Illustration of an organized folder tree of code files"
            icon={<FolderTree className="h-5 w-5" />}
            title="Organized"
            desc="Class then Student then File. Always know who wrote what, and when it was last updated."
          />
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        PyClass — Python IDE for classrooms.
      </footer>
    </main>
  )
}

function Card({
  icon,
  title,
  desc,
  image,
  imageAlt,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  image: string
  imageAlt: string
}) {
  return (
    <div className="group flex flex-col items-start gap-3 overflow-hidden rounded-2xl border border-white/20 bg-card/40 text-left shadow-lg ring-1 ring-white/10 backdrop-blur-xl backdrop-saturate-150 transition-all duration-300 hover:-translate-y-1 hover:bg-card/55 hover:shadow-xl">
      <div className="aspect-[16/10] w-full overflow-hidden bg-secondary/50">
        <Image
          src={image || "/placeholder.svg"}
          alt={imageAlt}
          width={600}
          height={400}
          className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col items-start gap-3 p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground text-pretty">{desc}</p>
      </div>
    </div>
  )
}

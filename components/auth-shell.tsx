import type React from "react"
import Link from "next/link"
import { Play, FolderTree, GraduationCap } from "lucide-react"
import { Logo } from "@/components/logo"
import { AuthCodePreview } from "@/components/auth/auth-code-preview"

const features = [
  { icon: Play, title: "Two IDEs, nothing to install", desc: "Python, HTML, CSS & JS in the browser." },
  { icon: FolderTree, title: "Organized submissions", desc: "Class → student → file, all in one tree." },
  { icon: GraduationCap, title: "Simple join codes", desc: "Students join a class in seconds." },
]

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#0f1424] text-white lg:flex lg:flex-col lg:justify-between lg:gap-10 lg:px-10 lg:py-8 xl:px-12 [@media(min-height:900px)]:lg:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        />
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#8b5cf6]/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-[#3b82f6]/25 blur-3xl" />

        <Link href="/" className="relative w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
          <Logo
            iconClassName="h-10 w-10"
            textClassName="text-xl [&>span:nth-child(2)]:text-white"
            showTagline
          />
        </Link>

        <div className="relative flex max-w-lg flex-col gap-6 [@media(min-height:900px)]:gap-8">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
              Your classroom, ready when you are
            </p>
            <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight text-balance xl:text-[2.75rem]">
              Teach and learn to{" "}
              <span className="bg-gradient-to-r from-[#a78bfa] via-[#60a5fa] to-[#34d399] bg-clip-text text-transparent">
                code
              </span>{" "}
              in one clean workspace.
            </h2>
          </div>

          <AuthCodePreview />

          <ul className="grid grid-cols-3 gap-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-sm">
                <span className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-[#93c5fd]">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium leading-snug">{title}</p>
                <p className="mt-1 hidden text-xs leading-relaxed text-white/55 text-pretty [@media(min-height:860px)]:block">{desc}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/45">Built for classrooms of every size.</p>
      </aside>

      <main className="relative flex flex-col items-center justify-center overflow-hidden px-5 py-10 sm:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-[#8b5cf6]/10 blur-3xl" />

        <Link href="/" className="relative mb-8 lg:hidden">
          <Logo iconClassName="h-9 w-9" textClassName="text-lg" />
        </Link>

        <div className="relative w-full max-w-[26rem]">{children}</div>
      </main>
    </div>
  )
}

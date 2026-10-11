import type React from "react"
import Link from "next/link"
import { Code, GraduationCap, FolderCheck } from "lucide-react"
import { Logo } from "@/components/logo"

const features = [
  {
    icon: Code,
    title: "A growing coding workspace",
    desc: "Python, HTML and more tools and languages as MyCodePad grows.",
  },
  {
    icon: GraduationCap,
    title: "Learn independently or together",
    desc: "Practise at your own pace or collaborate through teacher-led classes.",
  },
  {
    icon: FolderCheck,
    title: "Your work, organised",
    desc: "Keep your coding projects and classroom tasks in one place.",
  },
]

const delay = (ms: number) => ({ "--auth-delay": `${ms}ms` }) as React.CSSProperties

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 lg:flex">
        <Link href="/" className="auth-rise w-fit" style={delay(0)}>
          <Logo iconClassName="h-10 w-10" textClassName="text-xl" showTagline />
        </Link>

        <div className="max-w-md">
          <h2
            className="auth-rise text-3xl font-semibold leading-tight text-balance text-sidebar-foreground"
            style={delay(100)}
          >
            Your ideas. Your code. Your workspace.
            <span aria-hidden="true" className="auth-caret ml-1 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] rounded-sm bg-primary" />
          </h2>
          <p className="auth-rise mt-3 text-muted-foreground text-pretty" style={delay(200)}>
            {"Learn to code, experiment with projects and teach programming \u2014 all in your browser."}
          </p>

          <ul className="mt-8 flex flex-col gap-5">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="auth-rise group flex gap-3" style={delay(320 + i * 90)}>
                <Icon
                  className="mt-0.5 h-5 w-5 shrink-0 text-primary transition-transform duration-300 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium text-sidebar-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground text-pretty">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-rise text-xs text-muted-foreground" style={delay(650)}>
          Built for classrooms of every size.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="auth-rise flex w-full justify-center" style={delay(150)}>
          {children}
        </div>
      </div>
    </div>
  )
}

type Token = [text: string, className?: string]

const kw = "text-[#c4b5fd]"
const fn = "text-[#93c5fd]"
const str = "text-[#6ee7b7]"
const num = "text-[#fcd34d]"
const dim = "text-white/40"

const lines: Token[][] = [
  [["# Lesson 3: loops", dim]],
  [["for ", kw], ["student "], ["in ", kw], ["class_list", fn], [":"]],
  [["    print", fn], ["("], ['f"Welcome, {student}!"', str], [")"]],
  [],
  [["score "], ["= ", kw], ["sum", fn], ["(["], ["9", num], [", "], ["8", num], [", "], ["10", num], ["])"]],
  [["print", fn], ["("], ['"Class average:"', str], [", score / "], ["3", num], [")"]],
]

export function AuthCodePreview() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1020]/80 shadow-2xl shadow-black/40 backdrop-blur"
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
        </div>
        <span className="font-mono text-xs text-white/50">lesson_3.py</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-[#34d399]/15 px-2 py-0.5 text-[11px] font-medium text-[#6ee7b7]">
          <span className="h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-current" />
          Run
        </span>
      </div>

      <pre className="px-4 py-3.5 font-mono text-[13px] leading-[1.4rem] text-white/85">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="mr-4 w-4 select-none text-right text-white/25">{i + 1}</span>
            <code>
              {line.length === 0 ? " " : line.map(([text, cls], j) => <span key={j} className={cls}>{text}</span>)}
              {i === lines.length - 1 && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] animate-pulse bg-[#93c5fd]" />}
            </code>
          </div>
        ))}
      </pre>

      <div className="border-t border-white/10 bg-black/20 px-4 py-3 font-mono text-[12px] leading-5">
        <p className="text-white/40">{">>> output"}</p>
        <p className="text-[#6ee7b7]">Welcome, Ada! Welcome, Alan! Welcome, Grace!</p>
        <p className="text-white/80">Class average: 9.0</p>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const SEGMENTS: { text: string; color?: string }[] = [
  { text: "Code" },
  { text: ".", color: "#8b5cf6" },
  { text: " Learn" },
  { text: ".", color: "#3b82f6" },
  { text: " Teach" },
  { text: ".", color: "#34d399" },
  { text: " Together" },
  { text: ".", color: "#3b82f6" },
]

const FULL_TEXT = SEGMENTS.map((s) => s.text).join("")
const TOTAL = FULL_TEXT.length
const START_DELAY_MS = 450
const CHAR_MS = 55
const DOT_PAUSE_MS = 180
const CARET_LINGER_MS = 1800

function renderUpTo(count: number) {
  let remaining = count
  return SEGMENTS.map((seg, i) => {
    if (remaining <= 0) return null
    const shown = seg.text.slice(0, remaining)
    remaining -= seg.text.length
    return (
      <span key={i} style={seg.color ? { color: seg.color } : undefined}>
        {shown}
      </span>
    )
  })
}

/**
 * "CODE. LEARN. TEACH. TOGETHER." typed out character by character. An
 * invisible full copy reserves the final width, so the header's crowding
 * measurement and surrounding layout never shift while it types.
 */
export function TypingTagline({ className }: { className?: string }) {
  const [count, setCount] = useState(0)
  const [caretVisible, setCaretVisible] = useState(true)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(TOTAL)
      setCaretVisible(false)
      return
    }

    let typed = 0
    let timer: ReturnType<typeof setTimeout>

    const step = () => {
      typed += 1
      setCount(typed)
      if (typed >= TOTAL) {
        timer = setTimeout(() => setCaretVisible(false), CARET_LINGER_MS)
        return
      }
      // A beat after each full stop gives the four words their rhythm.
      const justTypedDot = FULL_TEXT[typed - 1] === "."
      timer = setTimeout(step, CHAR_MS + (justTypedDot ? DOT_PAUSE_MS : 0))
    }

    timer = setTimeout(step, START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <span
      className={cn(
        "relative font-semibold uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      <span className="sr-only">{FULL_TEXT}</span>
      <span aria-hidden="true" className="invisible">
        {renderUpTo(TOTAL)}
      </span>
      <span aria-hidden="true" className="absolute inset-0 whitespace-nowrap">
        {renderUpTo(count)}
        <span
          className={cn(
            "ml-px inline-block h-[1.1em] w-[1.5px] translate-y-[0.15em] bg-[#3b82f6] transition-opacity duration-500",
            caretVisible ? "opacity-100" : "opacity-0",
          )}
          style={{ animation: caretVisible ? "pyide-caret 0.9s step-end infinite" : undefined }}
        />
      </span>
    </span>
  )
}

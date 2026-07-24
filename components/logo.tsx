import { cn } from "@/lib/utils"

/**
 * The My Code Pad app-icon mark: a dark rounded "code file" tile with window
 * dots, a gradient `</>` glyph, code lines, and a purple→blue folded corner.
 */
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="My Code Pad"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="mcp-code-green" x1="28" y1="40" x2="56" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="mcp-blue" x1="58" y1="40" x2="72" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="mcp-fold-blue" x1="40" y1="40" x2="94" y2="94" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="mcp-fold-purple" x1="58" y1="58" x2="94" y2="94" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
        <clipPath id="mcp-clip">
          <rect x="6" y="6" width="88" height="88" rx="24" />
        </clipPath>
      </defs>

      {/* Tile */}
      <rect x="6" y="6" width="88" height="88" rx="24" fill="#1b2233" />

      {/* Window dots */}
      <circle cx="24" cy="26" r="3.4" fill="#ff5f57" />
      <circle cx="35" cy="26" r="3.4" fill="#febc2e" />
      <circle cx="46" cy="26" r="3.4" fill="#28c840" />

      {/* </> glyph */}
      <g strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="40,42 29,53 40,64" stroke="url(#mcp-code-green)" />
        <line x1="55" y1="39" x2="46" y2="67" stroke="url(#mcp-code-green)" />
        <polyline points="59,42 70,53 59,64" stroke="url(#mcp-blue)" />
      </g>

      {/* Code lines */}
      <rect x="20" y="72" width="26" height="4.6" rx="2.3" fill="#33415c" />
      <rect x="20" y="80.5" width="15" height="4.6" rx="2.3" fill="#3b82f6" />

      {/* Folded corner */}
      <g clipPath="url(#mcp-clip)">
        <path d="M38 94 L94 94 L94 38 Z" fill="url(#mcp-fold-purple)" />
        <path d="M38 94 L94 38 L94 60 L60 94 Z" fill="url(#mcp-fold-blue)" />
      </g>
    </svg>
  )
}

/** The "mycodepad" wordmark with brand coloring. */
export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-semibold lowercase tracking-tight", className)}>
      <span className="text-[#8b5cf6]">my</span>
      <span className="text-foreground">code</span>
      <span className="text-[#3b82f6]">pad</span>
    </span>
  )
}

/** "CODE. LEARN. TEACH. TOGETHER." tagline with colored stops. */
export function LogoTagline({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      Code<span className="text-[#8b5cf6]">.</span> Learn<span className="text-[#3b82f6]">.</span> Teach
      <span className="text-[#34d399]">.</span> Together<span className="text-[#3b82f6]">.</span>
    </span>
  )
}

/** Icon + wordmark (with optional tagline) lockup. */
export function Logo({
  className,
  iconClassName = "h-9 w-9",
  textClassName = "text-lg",
  showText = true,
  showTagline = false,
}: {
  className?: string
  iconClassName?: string
  textClassName?: string
  showText?: boolean
  showTagline?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoIcon className={cn("shrink-0", iconClassName)} />
      {showText && (
        <span className="flex flex-col leading-none">
          <LogoWordmark className={textClassName} />
          {showTagline && <LogoTagline className="mt-1.5 text-[9px]" />}
        </span>
      )}
    </div>
  )
}

function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

export const SITE = {
  name: "mycodepad",
  url: getSiteUrl().replace(/\/$/, ""),
  title: "mycodepad — Python & HTML IDEs for Classrooms",
  shortDescription: "Browser Python and HTML IDEs for students, teachers and schools.",
  description:
    "mycodepad is a classroom coding workspace with two browser IDEs. Students write and run Python and build web pages with HTML, CSS and JavaScript, while teachers set work, mark submissions and give feedback in one organised class tree.",
  tagline: "Code. Learn. Teach. Together.",
  keywords: [
    "online Python IDE",
    "HTML CSS JavaScript editor",
    "coding for schools",
    "computer science classroom",
    "GCSE computer science",
    "A level computer science",
    "teach Python",
    "learn to code",
    "classroom coding platform",
    "coding homework",
    "school coding platform UK",
  ],
  themeColor: "#1b2233",
  brandPurple: "#8b5cf6",
  brandBlue: "#3b82f6",
}

export const LOGO_SVG = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="28" y1="40" x2="56" y2="66" gradientUnits="userSpaceOnUse"><stop stop-color="#34d399"/><stop offset="1" stop-color="#22d3ee"/></linearGradient><linearGradient id="b" x1="58" y1="40" x2="72" y2="66" gradientUnits="userSpaceOnUse"><stop stop-color="#60a5fa"/><stop offset="1" stop-color="#2563eb"/></linearGradient><linearGradient id="fb" x1="40" y1="40" x2="94" y2="94" gradientUnits="userSpaceOnUse"><stop stop-color="#60a5fa"/><stop offset="1" stop-color="#2563eb"/></linearGradient><linearGradient id="fp" x1="58" y1="58" x2="94" y2="94" gradientUnits="userSpaceOnUse"><stop stop-color="#8b5cf6"/><stop offset="1" stop-color="#6d28d9"/></linearGradient><clipPath id="c"><rect x="6" y="6" width="88" height="88" rx="24"/></clipPath></defs><rect x="6" y="6" width="88" height="88" rx="24" fill="#1b2233"/><circle cx="24" cy="26" r="3.4" fill="#ff5f57"/><circle cx="35" cy="26" r="3.4" fill="#febc2e"/><circle cx="46" cy="26" r="3.4" fill="#28c840"/><g stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="40,42 29,53 40,64" stroke="url(#g)"/><line x1="55" y1="39" x2="46" y2="67" stroke="url(#g)"/><polyline points="59,42 70,53 59,64" stroke="url(#b)"/></g><rect x="20" y="72" width="26" height="4.6" rx="2.3" fill="#33415c"/><rect x="20" y="80.5" width="15" height="4.6" rx="2.3" fill="#3b82f6"/><g clip-path="url(#c)"><path d="M38 94 L94 94 L94 38 Z" fill="url(#fp)"/><path d="M38 94 L94 38 L94 60 L60 94 Z" fill="url(#fb)"/></g></svg>`

export const LOGO_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`

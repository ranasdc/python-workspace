import { useSyncExternalStore } from "react"

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

declare global {
  interface Window {
    /** Stashed by the inline script in the root layout, which runs before hydration. */
    __mcpInstallEvent?: InstallPromptEvent | null
    __mcpInstalled?: boolean
  }
  interface Navigator {
    /** iOS Safari's non-standard flag for a Home Screen launch. */
    standalone?: boolean
  }
}

export type Platform =
  | "ios"
  | "android"
  | "desktop-chromium"
  | "desktop-safari"
  | "firefox"
  | "other"

export type PwaState = {
  ready: boolean
  platform: Platform
  /** Running as the installed app rather than in a browser tab. */
  standalone: boolean
  installed: boolean
  canPrompt: boolean
  online: boolean
  updateReady: boolean
}

export type InstallMode = "installed" | "prompt" | "instructions" | "unsupported"

const INSTALLED_KEY = "mcp:pwa-installed"

const SERVER_STATE: PwaState = {
  ready: false,
  platform: "other",
  standalone: false,
  installed: false,
  canPrompt: false,
  online: true,
  updateReady: false,
}

let state = SERVER_STATE
let installEvent: InstallPromptEvent | null = null
let waitingWorker: ServiceWorker | null = null
let updateRequested = false
let started = false
const listeners = new Set<() => void>()

function update(patch: Partial<PwaState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePwa() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  )
}

function readFlag(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeFlag(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Private mode or storage disabled: the flag is only a hint.
  }
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  const isIos =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (isIos) return "ios"
  if (/Android/i.test(ua)) return "android"
  if (/Firefox\//i.test(ua)) return "firefox"
  if (/Chrome\/|Chromium\/|Edg\//.test(ua)) return "desktop-chromium"
  if (/Safari\//.test(ua) && /Macintosh/.test(ua)) return "desktop-safari"
  return "other"
}

export function installMode(s: PwaState): InstallMode {
  if (s.installed) return "installed"
  if (s.canPrompt) return "prompt"
  if (s.platform === "firefox" || s.platform === "other") return "unsupported"
  return "instructions"
}

export function installPitch(isTeacher: boolean) {
  return isTeacher
    ? "Keep your classes, students and coding tools one click away."
    : "Keep your coding workspace one click away."
}

function markInstalled() {
  installEvent = null
  writeFlag(INSTALLED_KEY, "1")
  update({ installed: true, canPrompt: false })
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = installEvent
  if (!event) return "unavailable"
  // The browser allows each captured event to be used once.
  installEvent = null
  update({ canPrompt: false })
  await event.prompt()
  const { outcome } = await event.userChoice
  if (outcome === "accepted") markInstalled()
  return outcome
}

/** Only called after the user clicks Refresh, so a session is never reloaded on its own. */
export function applyUpdate() {
  if (!waitingWorker) {
    window.location.reload()
    return
  }
  updateRequested = true
  waitingWorker.postMessage({ type: "SKIP_WAITING" })
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return

  // Dev builds aren't content-hashed, so a worker there would serve stale code.
  if (process.env.NODE_ENV !== "production") {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
    return
  }

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  })

  const track = (worker: ServiceWorker | null) => {
    if (!worker) return
    const check = () => {
      // With no controller this is the first install, not an update.
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        waitingWorker = worker
        update({ updateReady: true })
      }
    }
    check()
    worker.addEventListener("statechange", check)
  }

  track(registration.waiting)
  registration.addEventListener("updatefound", () => track(registration.installing))

  let reloading = false
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!updateRequested || reloading) return
    reloading = true
    window.location.reload()
  })

  const checkForUpdate = () => registration.update().catch(() => {})
  window.setInterval(checkForUpdate, 60 * 60 * 1000)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate()
  })
}

export function startPwa() {
  if (started || typeof window === "undefined") return
  started = true

  const standaloneQuery = window.matchMedia("(display-mode: standalone)")
  const isStandalone = () => standaloneQuery.matches || navigator.standalone === true

  installEvent = window.__mcpInstallEvent ?? null
  const standalone = isStandalone()
  if (standalone) writeFlag(INSTALLED_KEY, "1")
  // The browser only offers an install prompt when the app isn't installed.
  if (installEvent) writeFlag(INSTALLED_KEY, null)
  const remembered = readFlag(INSTALLED_KEY) === "1" || window.__mcpInstalled === true

  update({
    ready: true,
    platform: detectPlatform(),
    standalone,
    installed: standalone || (remembered && !installEvent),
    canPrompt: Boolean(installEvent),
    online: navigator.onLine,
  })

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    installEvent = event as InstallPromptEvent
    writeFlag(INSTALLED_KEY, null)
    update({ canPrompt: true, installed: isStandalone() })
  })
  window.addEventListener("appinstalled", markInstalled)
  standaloneQuery.addEventListener("change", () => {
    const now = isStandalone()
    update({ standalone: now, installed: now || state.installed })
  })
  window.addEventListener("online", () => update({ online: true }))
  window.addEventListener("offline", () => update({ online: false }))

  const register = () => {
    registerServiceWorker().catch((error) => console.error("[pwa] service worker failed:", error))
  }
  if (document.readyState === "complete") register()
  else window.addEventListener("load", register, { once: true })
}

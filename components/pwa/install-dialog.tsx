"use client"

import { CircleCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LogoIcon } from "@/components/logo"
import { installMode, installPitch, promptInstall, usePwa, type Platform } from "@/lib/pwa"

const STEPS: Record<Platform, string[]> = {
  ios: [
    "Tap the Share button in Safari's toolbar.",
    "Scroll down and choose Add to Home Screen.",
    "Tap Add. MyCodePad appears on your Home Screen.",
  ],
  android: [
    "Open your browser menu (the three dots).",
    "Choose Install app or Add to Home screen.",
    "Confirm, and MyCodePad appears with your other apps.",
  ],
  "desktop-chromium": [
    "Click the install icon at the right of the address bar.",
    "Or open the browser menu and choose Install MyCodePad. In Edge it is under Apps.",
    "MyCodePad then opens in its own window and appears with your apps.",
  ],
  "desktop-safari": [
    "In the menu bar, choose File, then Add to Dock.",
    "Click Add. MyCodePad opens in its own window from your Dock.",
  ],
  firefox: [
    "This browser can't install web apps.",
    "Open MyCodePad in Chrome, Edge or Safari to install it.",
  ],
  other: [
    "This browser can't install web apps.",
    "Open MyCodePad in Chrome, Edge or Safari to install it.",
  ],
}

export function InstallDialog({
  open,
  onOpenChange,
  isTeacher,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isTeacher: boolean
}) {
  const pwa = usePwa()
  const mode = installMode(pwa)

  async function handleInstall() {
    const outcome = await promptInstall()
    if (outcome === "accepted") onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <LogoIcon className="size-10 shrink-0" />
            <DialogTitle>
              {mode === "installed" ? "MyCodePad is installed" : "Install MyCodePad"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {mode === "installed"
              ? "Open MyCodePad from your apps, Dock or Home Screen to start coding."
              : installPitch(isTeacher)}
          </DialogDescription>
        </DialogHeader>

        {mode === "installed" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-emerald-500" aria-hidden="true" />
            You can keep using it in the browser too.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {STEPS[pwa.platform].map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed">
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                >
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          {mode === "prompt" ? <Button onClick={handleInstall}>Install now</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

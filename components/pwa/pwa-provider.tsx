"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { applyUpdate, startPwa, usePwa } from "@/lib/pwa"
import { cn } from "@/lib/utils"

function ConnectionStatus() {
  const { ready, online } = usePwa()
  const [showReconnected, setShowReconnected] = useState(false)
  const wasOffline = useRef(false)

  useEffect(() => {
    if (!ready) return
    if (!online) {
      wasOffline.current = true
      setShowReconnected(false)
      return
    }
    if (!wasOffline.current) return
    wasOffline.current = false
    setShowReconnected(true)
    const timer = window.setTimeout(() => setShowReconnected(false), 3000)
    return () => window.clearTimeout(timer)
  }, [ready, online])

  const visible = ready && (!online || showReconnected)

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4"
    >
      {visible ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-md">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", online ? "bg-emerald-500" : "bg-amber-500")}
          />
          {online ? "Back online" : "Offline — some features unavailable"}
        </span>
      ) : null}
    </div>
  )
}

function UpdateNotifier() {
  const { updateReady } = usePwa()

  useEffect(() => {
    if (!updateReady) return
    toast("New version of MyCodePad available.", {
      id: "mcp-update",
      description: "Refresh when you're ready. Your work is saved.",
      duration: Number.POSITIVE_INFINITY,
      action: { label: "Refresh", onClick: applyUpdate },
    })
  }, [updateReady])

  return null
}

export function PwaProvider() {
  useEffect(() => {
    startPwa()
  }, [])

  return (
    <>
      <ConnectionStatus />
      <UpdateNotifier />
    </>
  )
}

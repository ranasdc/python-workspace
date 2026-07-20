"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const PYODIDE_VERSION = "0.26.4"
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>
  setStdout: (opts: { batched: (s: string) => void }) => void
  setStderr: (opts: { batched: (s: string) => void }) => void
  setStdin: (opts: { stdin: () => string | null | undefined; autoEOF?: boolean }) => void
  globals: { get: (k: string) => unknown }
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInterface>
  }
}

export type RunStatus = "loading" | "ready" | "running" | "error"

export function usePyodide() {
  const pyodideRef = useRef<PyodideInterface | null>(null)
  const [status, setStatus] = useState<RunStatus>("loading")
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        if (!window.loadPyodide) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script")
            script.src = `${PYODIDE_URL}pyodide.js`
            script.onload = () => resolve()
            script.onerror = () => reject(new Error("Failed to load Pyodide script"))
            document.head.appendChild(script)
          })
        }
        if (cancelled) return
        const pyodide = await window.loadPyodide!({ indexURL: PYODIDE_URL })
        if (cancelled) return
        pyodideRef.current = pyodide
        setStatus("ready")
      } catch (err) {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : "Failed to load Python runtime")
        setStatus("error")
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const run = useCallback(
    async (
      code: string,
      onOutput: (line: string, kind: "out" | "err") => void,
      stdin?: string,
    ) => {
      const pyodide = pyodideRef.current
      if (!pyodide) return
      setStatus("running")
      pyodide.setStdout({ batched: (s) => onOutput(s, "out") })
      pyodide.setStderr({ batched: (s) => onOutput(s, "err") })

      // Feed pre-typed stdin lines first; when exhausted, fall back to an
      // interactive browser prompt so students can type input on demand.
      const queued = stdin && stdin.length > 0 ? stdin.replace(/\r\n/g, "\n").split("\n") : []
      // A trailing newline in the buffer produces one empty element — drop it.
      if (queued.length > 0 && queued[queued.length - 1] === "") queued.pop()
      let idx = 0
      pyodide.setStdin({
        stdin: () => {
          if (idx < queued.length) return queued[idx++]
          if (typeof window !== "undefined") {
            const val = window.prompt("Program input (stdin):")
            return val === null ? undefined : val
          }
          return undefined
        },
      })

      try {
        await pyodide.runPythonAsync(code)
      } catch (err) {
        onOutput(err instanceof Error ? err.message : String(err), "err")
      } finally {
        setStatus("ready")
      }
    },
    [],
  )

  return { status, loadError, run }
}

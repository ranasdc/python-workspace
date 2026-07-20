"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const PYODIDE_VERSION = "0.26.4"
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

const CONTROL_LEN = 2 // Int32Array: [0]=state, [1]=byte length
const DATA_BYTES = 1 << 16 // 64 KB input buffer

const STATE_WAITING = 0
const STATE_READY = 1
const STATE_EOF = 2

export type RunStatus = "loading" | "ready" | "running" | "error"
export type OutputFn = (text: string, kind: "out" | "err") => void

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>
  setStdout: (opts: { batched: (s: string) => void }) => void
  setStderr: (opts: { batched: (s: string) => void }) => void
  setStdin: (opts: { stdin: () => string | null | undefined; autoEOF?: boolean }) => void
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInterface>
  }
}

export function usePyodide() {
  const [status, setStatus] = useState<RunStatus>("loading")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [awaitingInput, setAwaitingInput] = useState(false)
  const [interactive, setInteractive] = useState(false)

  // Worker-mode refs
  const workerRef = useRef<Worker | null>(null)
  const controlRef = useRef<Int32Array | null>(null)
  const dataRef = useRef<Uint8Array | null>(null)
  const outputRef = useRef<OutputFn | null>(null)
  const resolveRef = useRef<(() => void) | null>(null)

  // Main-thread fallback ref
  const pyodideRef = useRef<PyodideInterface | null>(null)

  useEffect(() => {
    const canSAB =
      typeof SharedArrayBuffer !== "undefined" &&
      typeof window !== "undefined" &&
      window.crossOriginIsolated === true

    let cancelled = false

    if (canSAB) {
      setInteractive(true)
      const worker = new Worker("/pyodide-worker.js")
      workerRef.current = worker

      const controlSAB = new SharedArrayBuffer(CONTROL_LEN * Int32Array.BYTES_PER_ELEMENT)
      const dataSAB = new SharedArrayBuffer(DATA_BYTES)
      controlRef.current = new Int32Array(controlSAB)
      dataRef.current = new Uint8Array(dataSAB)

      worker.onmessage = (e: MessageEvent) => {
        const m = e.data
        switch (m.type) {
          case "ready":
            setStatus("ready")
            break
          case "stdout":
            outputRef.current?.(m.text, "out")
            break
          case "stderr":
            outputRef.current?.(m.text, "err")
            break
          case "input":
            setAwaitingInput(true)
            break
          case "done":
            setAwaitingInput(false)
            setStatus("ready")
            resolveRef.current?.()
            resolveRef.current = null
            break
          case "fatal":
            setLoadError(m.error || "Failed to load Python runtime")
            setStatus("error")
            break
        }
      }

      worker.postMessage({ type: "init", control: controlSAB, data: dataSAB })

      return () => {
        cancelled = true
        worker.terminate()
      }
    }

    // Fallback: run on the main thread and use window.prompt for input().
    setInteractive(false)
    async function loadMainThread() {
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
    loadMainThread()
    return () => {
      cancelled = true
    }
  }, [])

  const run = useCallback(
    (code: string, onOutput: OutputFn): Promise<void> => {
      // Worker mode: stream output over postMessage, resolve on "done".
      if (workerRef.current && controlRef.current) {
        return new Promise<void>((resolve) => {
          outputRef.current = onOutput
          resolveRef.current = resolve
          setStatus("running")
          workerRef.current!.postMessage({ type: "run", code })
        })
      }

      // Fallback: main-thread execution with a blocking prompt for input().
      const pyodide = pyodideRef.current
      if (!pyodide) return Promise.resolve()
      setStatus("running")
      pyodide.setStdout({ batched: (s) => onOutput(s + "\n", "out") })
      pyodide.setStderr({ batched: (s) => onOutput(s + "\n", "err") })
      pyodide.setStdin({
        autoEOF: false,
        stdin: () => {
          const val = typeof window !== "undefined" ? window.prompt("Program input:") : null
          return val === null ? null : val + "\n"
        },
      })
      return pyodide
        .runPythonAsync(code)
        .catch((err: unknown) => {
          onOutput((err instanceof Error ? err.message : String(err)) + "\n", "err")
        })
        .finally(() => {
          setStatus("ready")
        }) as Promise<void>
    },
    [],
  )

  // Send a line the user typed in the console to the blocked worker.
  const submitInput = useCallback((text: string) => {
    const control = controlRef.current
    const data = dataRef.current
    if (!control || !data) return
    const bytes = new TextEncoder().encode(text + "\n")
    const len = Math.min(bytes.length, data.length)
    data.set(bytes.subarray(0, len))
    Atomics.store(control, 1, len)
    Atomics.store(control, 0, STATE_READY)
    Atomics.notify(control, 0)
    setAwaitingInput(false)
  }, [])

  return { status, loadError, awaitingInput, interactive, run, submitInput }
}

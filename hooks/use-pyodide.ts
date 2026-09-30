"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const PYODIDE_VERSION = "0.26.4"
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

const CONTROL_LEN = 2 // Int32Array: [0]=state, [1]=byte length
const DATA_BYTES = 1 << 16 // 64 KB input buffer

const STATE_WAITING = 0
const STATE_READY = 1
const STATE_EOF = 2

// Python helpers for the main-thread fallback. Defines an async input() backed
// by the console, plus an AST transform that rewrites input() calls into
// `await __v0_input__(...)` and marks any enclosing functions async so input
// works anywhere (top level or nested in functions) without window.prompt.
const MAIN_THREAD_BOOTSTRAP = `
import ast as _v0_ast
import sys as _v0_sys

async def __v0_input__(prompt=""):
    if prompt is not None and prompt != "":
        print(prompt, end="")
        _v0_sys.stdout.flush()
    return await __v0_js_input__("" if prompt is None else str(prompt))

def __v0_transform_source(code):
    tree = _v0_ast.parse(code)
    func_by_name = {}

    class _Names(_v0_ast.NodeVisitor):
        def _f(self, node):
            func_by_name.setdefault(node.name, node)
            self.generic_visit(node)
        def visit_FunctionDef(self, node):
            self._f(node)
        def visit_AsyncFunctionDef(self, node):
            self._f(node)
    _Names().visit(tree)

    async_funcs = set()

    class _InputFinder(_v0_ast.NodeVisitor):
        def __init__(self):
            self.stack = [None]
        def _f(self, node):
            self.stack.append(node)
            self.generic_visit(node)
            self.stack.pop()
        def visit_FunctionDef(self, node):
            self._f(node)
        def visit_AsyncFunctionDef(self, node):
            self._f(node)
        def visit_Call(self, node):
            if isinstance(node.func, _v0_ast.Name) and node.func.id == "input":
                enc = self.stack[-1]
                if enc is not None:
                    async_funcs.add(enc)
            self.generic_visit(node)
    _InputFinder().visit(tree)

    changed = True
    while changed:
        changed = False
        class _Prop(_v0_ast.NodeVisitor):
            def __init__(self):
                self.stack = [None]
            def _f(self, node):
                self.stack.append(node)
                self.generic_visit(node)
                self.stack.pop()
            def visit_FunctionDef(self, node):
                self._f(node)
            def visit_AsyncFunctionDef(self, node):
                self._f(node)
            def visit_Call(self, node):
                if isinstance(node.func, _v0_ast.Name):
                    tgt = func_by_name.get(node.func.id)
                    if tgt is not None and tgt in async_funcs:
                        enc = self.stack[-1]
                        if enc is not None and enc not in async_funcs:
                            async_funcs.add(enc)
                self.generic_visit(node)
        before = len(async_funcs)
        _Prop().visit(tree)
        changed = len(async_funcs) != before

    class _Rewriter(_v0_ast.NodeTransformer):
        def visit_Call(self, node):
            self.generic_visit(node)
            if isinstance(node.func, _v0_ast.Name):
                if node.func.id == "input":
                    return _v0_ast.Await(value=_v0_ast.Call(
                        func=_v0_ast.Name(id="__v0_input__", ctx=_v0_ast.Load()),
                        args=node.args, keywords=node.keywords))
                tgt = func_by_name.get(node.func.id)
                if tgt is not None and tgt in async_funcs:
                    return _v0_ast.Await(value=node)
            return node
        def visit_FunctionDef(self, node):
            self.generic_visit(node)
            if node in async_funcs:
                new = _v0_ast.AsyncFunctionDef(
                    name=node.name, args=node.args, body=node.body,
                    decorator_list=node.decorator_list, returns=node.returns)
                return _v0_ast.copy_location(new, node)
            return node
    tree = _Rewriter().visit(tree)
    _v0_ast.fix_missing_locations(tree)
    return _v0_ast.unparse(tree)
`

export type RunStatus = "loading" | "ready" | "running" | "error"
export type OutputFn = (text: string, kind: "out" | "err" | "info") => void

const STATE_STOP = 3
// How long a SIGINT gets to unwind the program before the worker is killed.
// Covers code that swallows KeyboardInterrupt or is stuck outside bytecode.
const HARD_STOP_MS = 700
const STOPPED_MESSAGE = "\nExecution stopped by user.\n"

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>
  setStdout: (opts: { batched: (s: string) => void }) => void
  setStderr: (opts: { batched: (s: string) => void }) => void
  setStdin: (opts: { stdin: () => string | null | undefined; autoEOF?: boolean }) => void
  globals: {
    set: (name: string, value: unknown) => void
    get: (name: string) => unknown
  }
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInterface>
  }
}

/**
 * @param enabled Gate the initial download. The runtime is several megabytes,
 *   so the HTML IDE should not fetch it — but once it has loaded we keep it,
 *   because tearing it down on every IDE switch would mean paying that cost
 *   again on the way back. `enabled` therefore latches on rather than toggling.
 */
export function usePyodide({ enabled = true }: { enabled?: boolean } = {}) {
  const [status, setStatus] = useState<RunStatus>("loading")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [awaitingInput, setAwaitingInput] = useState(false)
  const [interactive, setInteractive] = useState(false)
  const [shouldLoad, setShouldLoad] = useState(enabled)
  // Bumped by stop() to tear down and re-create the worker, which is how a
  // runaway program gets interrupted.
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (enabled) setShouldLoad(true)
  }, [enabled])

  // Worker-mode refs
  const workerRef = useRef<Worker | null>(null)
  const controlRef = useRef<Int32Array | null>(null)
  const dataRef = useRef<Uint8Array | null>(null)
  const outputRef = useRef<OutputFn | null>(null)
  const resolveRef = useRef<(() => void) | null>(null)
  const interruptRef = useRef<Uint8Array | null>(null)
  const runningRef = useRef(false)
  const hardStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Main-thread fallback refs
  const pyodideRef = useRef<PyodideInterface | null>(null)
  const mainInputResolveRef = useRef<((text: string) => void) | null>(null)
  const mainInputRejectRef = useRef<((err: Error) => void) | null>(null)
  const mainStoppedRef = useRef(false)

  const finishRun = useCallback((stopped: boolean) => {
    if (hardStopTimerRef.current) {
      clearTimeout(hardStopTimerRef.current)
      hardStopTimerRef.current = null
    }
    if (stopped) outputRef.current?.(STOPPED_MESSAGE, "info")
    runningRef.current = false
    setAwaitingInput(false)
    resolveRef.current?.()
    resolveRef.current = null
  }, [])

  useEffect(() => {
    if (!shouldLoad) return

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
      const interruptSAB = new SharedArrayBuffer(1)
      controlRef.current = new Int32Array(controlSAB)
      dataRef.current = new Uint8Array(dataSAB)
      interruptRef.current = new Uint8Array(interruptSAB)

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
            setStatus("ready")
            finishRun(Boolean(m.stopped))
            break
          case "fatal":
            setLoadError(m.error || "Failed to load Python runtime")
            setStatus("error")
            break
        }
      }

      worker.postMessage({
        type: "init",
        control: controlSAB,
        data: dataSAB,
        interrupt: interruptSAB,
      })

      return () => {
        cancelled = true
        worker.terminate()
      }
    }

    // Fallback: run on the main thread. Input is still typed inline in the
    // console (not a browser prompt) via an async, promise-backed input().
    setInteractive(true)
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

        // Bridge Python input() to the console's inline input field.
        pyodide.globals.set(
          "__v0_js_input__",
          (promptText: string) =>
            new Promise<string>((resolve, reject) => {
              void promptText
              mainInputResolveRef.current = resolve
              mainInputRejectRef.current = reject
              setAwaitingInput(true)
            }),
        )
        await pyodide.runPythonAsync(MAIN_THREAD_BOOTSTRAP)
        if (cancelled) return
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
  }, [shouldLoad, reloadToken])

  const run = useCallback(
    (code: string, onOutput: OutputFn): Promise<void> => {
      // Worker mode: stream output over postMessage, resolve on "done".
      if (workerRef.current && controlRef.current) {
        return new Promise<void>((resolve) => {
          outputRef.current = onOutput
          resolveRef.current = resolve
          runningRef.current = true
          setStatus("running")
          workerRef.current!.postMessage({ type: "run", code })
        })
      }

      // Fallback: main-thread execution with inline console input().
      const pyodide = pyodideRef.current
      if (!pyodide) return Promise.resolve()
      outputRef.current = onOutput
      mainStoppedRef.current = false
      runningRef.current = true
      setStatus("running")
      pyodide.setStdout({ batched: (s) => onOutput(s + "\n", "out") })
      pyodide.setStderr({ batched: (s) => onOutput(s + "\n", "err") })

      let transformed = code
      try {
        const result = (pyodide.globals.get("__v0_transform_source") as (c: string) => string)(code)
        if (typeof result === "string") transformed = result
      } catch {
        // Keep the original source; runPythonAsync will surface any error.
        transformed = code
      }

      return pyodide
        .runPythonAsync(transformed)
        .catch((err: unknown) => {
          if (mainStoppedRef.current) return
          onOutput((err instanceof Error ? err.message : String(err)) + "\n", "err")
        })
        .finally(() => {
          if (mainStoppedRef.current) onOutput(STOPPED_MESSAGE, "info")
          mainStoppedRef.current = false
          runningRef.current = false
          setStatus("ready")
          setAwaitingInput(false)
          mainInputResolveRef.current = null
          mainInputRejectRef.current = null
        }) as Promise<void>
    },
    [],
  )

  // Send a line the user typed in the console to whichever runtime is blocked.
  const submitInput = useCallback((text: string) => {
    // Worker mode: write into the SharedArrayBuffer and wake the worker.
    const control = controlRef.current
    const data = dataRef.current
    if (control && data) {
      const bytes = new TextEncoder().encode(text + "\n")
      const len = Math.min(bytes.length, data.length)
      data.set(bytes.subarray(0, len))
      Atomics.store(control, 1, len)
      Atomics.store(control, 0, STATE_READY)
      Atomics.notify(control, 0)
      setAwaitingInput(false)
      return
    }

    // Main-thread fallback: resolve the pending input() promise.
    if (mainInputResolveRef.current) {
      const resolve = mainInputResolveRef.current
      mainInputResolveRef.current = null
      setAwaitingInput(false)
      resolve(text)
    }
  }, [])

  // Force-stop a running program, including one blocked on input() or stuck in
  // an infinite loop. Worker mode first raises KeyboardInterrupt through the
  // interrupt buffer and wakes any blocked input(), which keeps the runtime
  // warm so the next Run is instant. If the program has not unwound within
  // HARD_STOP_MS (e.g. it swallows KeyboardInterrupt), the worker is killed
  // and a fresh one is started, so execution is guaranteed to end.
  const stop = useCallback(() => {
    const worker = workerRef.current
    if (worker) {
      if (!runningRef.current) return
      const control = controlRef.current
      if (interruptRef.current) interruptRef.current[0] = 2
      if (control) {
        Atomics.store(control, 0, STATE_STOP)
        Atomics.notify(control, 0)
      }
      setAwaitingInput(false)
      if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current)
      hardStopTimerRef.current = setTimeout(() => {
        hardStopTimerRef.current = null
        if (!runningRef.current || workerRef.current !== worker) return
        worker.terminate()
        workerRef.current = null
        finishRun(true)
        setStatus("loading")
        setReloadToken((t) => t + 1)
      }, HARD_STOP_MS)
      return
    }

    // Main-thread fallback: rejecting the pending input() unwinds the program.
    // Synchronous loops cannot run here without freezing the page, so a
    // pending input() is the only state this path ever needs to cancel.
    if (!runningRef.current) return
    mainStoppedRef.current = true
    const reject = mainInputRejectRef.current
    mainInputResolveRef.current = null
    mainInputRejectRef.current = null
    setAwaitingInput(false)
    reject?.(new Error("KeyboardInterrupt"))
  }, [finishRun])

  useEffect(
    () => () => {
      if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current)
    },
    [],
  )

  return { status, loadError, awaitingInput, interactive, run, submitInput, stop }
}

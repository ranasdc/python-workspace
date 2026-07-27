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
export type OutputFn = (text: string, kind: "out" | "err") => void

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

  // Main-thread fallback refs
  const pyodideRef = useRef<PyodideInterface | null>(null)
  const mainInputResolveRef = useRef<((text: string) => void) | null>(null)

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
            new Promise<string>((resolve) => {
              void promptText
              mainInputResolveRef.current = resolve
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

      // Fallback: main-thread execution with inline console input().
      const pyodide = pyodideRef.current
      if (!pyodide) return Promise.resolve()
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
          onOutput((err instanceof Error ? err.message : String(err)) + "\n", "err")
        })
        .finally(() => {
          setStatus("ready")
          setAwaitingInput(false)
          mainInputResolveRef.current = null
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

  return { status, loadError, awaitingInput, interactive, run, submitInput }
}

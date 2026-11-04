/* eslint-disable no-restricted-globals */
// Pyodide runs here in a Web Worker so that Python's synchronous input()
// can block this thread (via Atomics.wait) while the main thread collects a
// line the user types into the console.
//
// The runtime URL is sent in the init message rather than hardcoded here,
// because this file is served as-is from /public and cannot import from
// lib/ide/pyodide-runtime.ts. That module stays the single source of truth.

let pyodide = null
let control = null // Int32Array over a SharedArrayBuffer: [0]=state, [1]=byteLength
let dataBuf = null // Uint8Array over a SharedArrayBuffer for the input bytes
// Guards against a second init message starting a parallel download.
let initStarted = false
// Set once initialisation has either succeeded or been reported as failed, so
// a late error cannot report a second outcome.
let initSettled = false

/**
 * Report a failure that happened while starting Python.
 *
 * Emscripten does not always reject loadPyodide()'s promise when an asset is
 * missing — a failed WebAssembly instantiation can call abort() from a
 * callback outside the promise chain, leaving it pending forever. That is a
 * hang no try/catch can see, so unhandled errors and rejections are treated as
 * init failures too while init is in flight.
 */
function reportInitFailure(message) {
  if (initSettled) return
  initSettled = true
  initStarted = false // let the main thread retry into a fresh worker
  self.postMessage({ type: "fatal", error: message })
}

self.addEventListener("error", (event) => {
  if (initSettled) return
  event.preventDefault()
  reportInitFailure(event.message || "Python runtime failed to start")
})

self.addEventListener("unhandledrejection", (event) => {
  if (initSettled) return
  event.preventDefault()
  const reason = event.reason
  reportInitFailure(
    (reason && reason.message ? reason.message : String(reason)) ||
      "Python runtime failed to start",
  )
})

const stdoutDecoder = new TextDecoder()
const stderrDecoder = new TextDecoder()
const inputDecoder = new TextDecoder()

// Buffered line the current input() call is consuming, plus a read cursor.
let inputBuffer = ""
let inputPos = 0

// state values written by the main thread into control[0]
const STATE_WAITING = 0
const STATE_READY = 1
const STATE_EOF = 2
// Written by the main thread when the user presses Stop while input() is
// blocked, so the blocked read wakes up instead of waiting forever.
const STATE_STOP = 3

// Pyodide checks this buffer between bytecodes; writing 2 (SIGINT) raises
// KeyboardInterrupt inside the running program, which is how Stop interrupts
// infinite loops without tearing down the whole runtime.
let interruptBuf = null

function stopRequested() {
  return (interruptBuf && interruptBuf[0] !== 0) || Atomics.load(control, 0) === STATE_STOP
}

// Headers-only request, so this costs no meaningful bandwidth even on a slow
// school connection.
const PREFLIGHT_TIMEOUT_MS = 15000

/**
 * Confirm the WebAssembly binary is reachable before handing over to Pyodide.
 *
 * Emscripten does not reject loadPyodide()'s promise when this file is missing
 * or blocked: it aborts from inside an instantiation callback and the promise
 * stays pending forever. Nothing downstream can observe that, so without this
 * check an incomplete mirror shows a spinner until the main thread's timeout
 * finally gives up two minutes later.
 *
 * Only a definite "missing" or "unreachable" answer fails here. A host that
 * refuses HEAD with 403 or 405 still serves GET perfectly well, so those are
 * allowed through and the main thread's timeout stays the backstop.
 */
async function preflightRuntime(indexURL) {
  const url = `${indexURL}pyodide.asm.wasm`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS)

  try {
    const response = await fetch(url, { method: "HEAD", signal: controller.signal })
    if (response.status === 404 || response.status === 410) {
      throw new Error(`Python runtime file is missing: ${url} returned ${response.status}`)
    }
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error(`Timed out requesting ${url}`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function init(indexURL, controlSAB, dataSAB, interruptSAB) {
  control = new Int32Array(controlSAB)
  dataBuf = new Uint8Array(dataSAB)

  // importScripts is synchronous and throws on a blocked or failed request.
  // Previously this ran at the top level of the worker, where a throw killed
  // the worker before it had an onmessage handler — the main thread heard
  // nothing back and sat on "Loading Python" forever. Running it inside init
  // means a blocked CDN is reported as a normal failure instead.
  importScripts(`${indexURL}pyodide.js`)

  // Tells the main thread the loader itself got through, so it can stop
  // applying the short "is the CDN reachable at all" budget and switch to the
  // longer one that covers the multi-megabyte download.
  self.postMessage({ type: "stage", stage: "loader" })

  await preflightRuntime(indexURL)

  pyodide = await loadPyodide({ indexURL })

  if (interruptSAB) {
    interruptBuf = new Uint8Array(interruptSAB)
    pyodide.setInterruptBuffer(interruptBuf)
  }

  pyodide.setStdout({
    write: (buf) => {
      self.postMessage({ type: "stdout", text: stdoutDecoder.decode(buf, { stream: true }) })
      return buf.length
    },
  })
  pyodide.setStderr({
    write: (buf) => {
      self.postMessage({ type: "stderr", text: stderrDecoder.decode(buf, { stream: true }) })
      return buf.length
    },
  })
  pyodide.setStdin({
    // Return whole lines. Pyodide calls read() with our stdin repeatedly; we
    // hand back one full line (including its trailing "\n") per call, blocking
    // on the main thread for each new line. Returning a string here is treated
    // as a complete read chunk, so one typed line satisfies one input() call.
    read: (buffer) => {
      // Fetch a fresh line from the main thread if the current one is drained.
      if (inputPos >= inputBuffer.length) {
        Atomics.store(control, 0, STATE_WAITING)
        self.postMessage({ type: "input" })
        Atomics.wait(control, 0, STATE_WAITING)

        const state = Atomics.load(control, 0)
        if (state === STATE_EOF || state === STATE_STOP) return 0 // EOF

        const len = Atomics.load(control, 1)
        const bytes = dataBuf.slice(0, len)
        inputBuffer = inputDecoder.decode(bytes)
        inputPos = 0
      }

      // Copy as much of the remaining line as fits into Pyodide's buffer.
      const remaining = inputBuffer.slice(inputPos)
      const encoded = new TextEncoder().encode(remaining)
      const n = Math.min(encoded.length, buffer.length)
      buffer.set(encoded.subarray(0, n))
      // Advance the cursor by however many characters the bytes represent.
      inputPos += inputDecoder.decode(encoded.subarray(0, n)).length
      return n
    },
  })

  // From here on, errors belong to the student's program, not to startup.
  initSettled = true
  self.postMessage({ type: "ready" })
}

self.onmessage = async (e) => {
  const msg = e.data
  if (msg.type === "init") {
    if (initStarted) return
    initStarted = true
    try {
      await init(msg.indexURL, msg.control, msg.data, msg.interrupt)
    } catch (err) {
      reportInitFailure(err && err.message ? err.message : String(err))
    }
    return
  }
  if (msg.type === "run") {
    if (!pyodide) return
    inputBuffer = ""
    inputPos = 0
    if (interruptBuf) interruptBuf[0] = 0
    Atomics.store(control, 0, STATE_WAITING)
    let stopped = false
    try {
      await pyodide.runPythonAsync(msg.code)
    } catch (err) {
      stopped = stopRequested()
      // The KeyboardInterrupt/EOFError traceback caused by Stop is noise; the
      // main thread prints a single "Execution stopped by user." instead.
      if (!stopped) {
        self.postMessage({
          type: "stderr",
          text: (err && err.message ? err.message : String(err)) + "\n",
        })
      }
    } finally {
      stopped = stopped || stopRequested()
      if (interruptBuf) interruptBuf[0] = 0
      Atomics.store(control, 0, STATE_WAITING)
      self.postMessage({ type: "done", stopped })
    }
  }
}

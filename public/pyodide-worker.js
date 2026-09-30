/* eslint-disable no-restricted-globals */
// Pyodide runs here in a Web Worker so that Python's synchronous input()
// can block this thread (via Atomics.wait) while the main thread collects a
// line the user types into the console.

const PYODIDE_VERSION = "0.26.4"
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

importScripts(`${PYODIDE_URL}pyodide.js`)

let pyodide = null
let control = null // Int32Array over a SharedArrayBuffer: [0]=state, [1]=byteLength
let dataBuf = null // Uint8Array over a SharedArrayBuffer for the input bytes

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

async function init(controlSAB, dataSAB, interruptSAB) {
  control = new Int32Array(controlSAB)
  dataBuf = new Uint8Array(dataSAB)

  pyodide = await loadPyodide({ indexURL: PYODIDE_URL })

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

  self.postMessage({ type: "ready" })
}

self.onmessage = async (e) => {
  const msg = e.data
  if (msg.type === "init") {
    try {
      await init(msg.control, msg.data, msg.interrupt)
    } catch (err) {
      self.postMessage({ type: "fatal", error: err && err.message ? err.message : String(err) })
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

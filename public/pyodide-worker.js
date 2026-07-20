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

// state values written by the main thread into control[0]
const STATE_WAITING = 0
const STATE_READY = 1
const STATE_EOF = 2

async function init(controlSAB, dataSAB) {
  control = new Int32Array(controlSAB)
  dataBuf = new Uint8Array(dataSAB)

  pyodide = await loadPyodide({ indexURL: PYODIDE_URL })

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
    autoEOF: false,
    stdin: () => {
      // Ask the main thread for a line, then block until it writes one.
      Atomics.store(control, 0, STATE_WAITING)
      self.postMessage({ type: "input" })
      Atomics.wait(control, 0, STATE_WAITING)

      if (Atomics.load(control, 0) === STATE_EOF) return null
      const len = Atomics.load(control, 1)
      // Copy out of the SharedArrayBuffer before decoding (TextDecoder cannot
      // read directly from a shared buffer view).
      const bytes = dataBuf.slice(0, len)
      return inputDecoder.decode(bytes)
    },
  })

  self.postMessage({ type: "ready" })
}

self.onmessage = async (e) => {
  const msg = e.data
  if (msg.type === "init") {
    try {
      await init(msg.control, msg.data)
    } catch (err) {
      self.postMessage({ type: "fatal", error: err && err.message ? err.message : String(err) })
    }
    return
  }
  if (msg.type === "run") {
    if (!pyodide) return
    try {
      await pyodide.runPythonAsync(msg.code)
    } catch (err) {
      self.postMessage({
        type: "stderr",
        text: (err && err.message ? err.message : String(err)) + "\n",
      })
    } finally {
      self.postMessage({ type: "done" })
    }
  }
}

#!/usr/bin/env node
/**
 * Mirror the complete Pyodide runtime into public/ so Python can be served
 * from MyCodePad's own domain instead of cdn.jsdelivr.net, which some school
 * networks block as a content delivery service.
 *
 *   node scripts/fetch-pyodide-runtime.mjs
 *
 * Then point the app at the mirror:
 *   NEXT_PUBLIC_PYODIDE_INDEX_URL=/pyodide/v0.26.4/full/
 *
 * Every file is verified against its expected size before the run is called a
 * success, because a half-written mirror fails at runtime in exactly the same
 * confusing way as a blocked CDN. The version is read from the app's own
 * config so the mirror can never drift to a different Pyodide release.
 */

import { createWriteStream } from "node:fs"
import { mkdir, readFile, rm, stat } from "node:fs/promises"
import { dirname, join } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const CONFIG = join(ROOT, "lib", "ide", "pyodide-runtime.ts")

/**
 * Parse the version and file manifest out of the TypeScript config rather than
 * duplicating them here, so this script and the app can never disagree about
 * which release is being served.
 */
async function readRuntimeConfig() {
  const source = await readFile(CONFIG, "utf8")

  const version = source.match(/PYODIDE_VERSION\s*=\s*"([^"]+)"/)?.[1]
  if (!version) throw new Error(`Could not read PYODIDE_VERSION from ${CONFIG}`)

  const block = source.match(/PYODIDE_RUNTIME_FILES\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1]
  if (!block) throw new Error(`Could not read PYODIDE_RUNTIME_FILES from ${CONFIG}`)

  const files = [...block.matchAll(/name:\s*"([^"]+)",\s*bytes:\s*([0-9_]+)/g)].map((m) => ({
    name: m[1],
    bytes: Number(m[2].replace(/_/g, "")),
  }))
  if (files.length === 0) throw new Error("PYODIDE_RUNTIME_FILES is empty")

  return { version, files }
}

function formatMB(bytes) {
  return `${(bytes / 1_000_000).toFixed(2)} MB`
}

async function download(url, destination) {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
}

async function main() {
  const { version, files } = await readRuntimeConfig()
  const source = `https://cdn.jsdelivr.net/pyodide/v${version}/full`
  const target = join(ROOT, "public", "pyodide", `v${version}`, "full")

  console.log(`Mirroring Pyodide ${version}`)
  console.log(`  from ${source}`)
  console.log(`  into public/pyodide/v${version}/full\n`)

  await mkdir(target, { recursive: true })

  let total = 0
  const problems = []

  for (const file of files) {
    const destination = join(target, file.name)
    process.stdout.write(`  ${file.name.padEnd(20)} `)

    try {
      await download(`${source}/${file.name}`, destination)
    } catch (error) {
      // A partial file is worse than no file: it would be served happily and
      // fail deep inside the WebAssembly loader.
      await rm(destination, { force: true })
      problems.push(`${file.name}: ${error.message}`)
      console.log("failed")
      continue
    }

    const { size } = await stat(destination)
    total += size

    // jsDelivr can serve a short body on a flaky connection without raising an
    // error, so trust the byte count rather than the absence of an exception.
    if (size !== file.bytes) {
      problems.push(`${file.name}: expected ${file.bytes} bytes, got ${size}`)
      console.log(`size mismatch (${size} vs ${file.bytes})`)
      continue
    }

    console.log(formatMB(size).padStart(9))
  }

  console.log(`\n  total${formatMB(total).padStart(24)}`)

  if (problems.length > 0) {
    console.error("\nMirror is incomplete and must not be deployed:")
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exitCode = 1
    return
  }

  console.log("\nComplete. Serve it by setting:")
  console.log(`  NEXT_PUBLIC_PYODIDE_INDEX_URL=/pyodide/v${version}/full/`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

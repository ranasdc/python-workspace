import { registerHooks } from "node:module"
import { pathToFileURL } from "node:url"
import { resolve as resolvePath } from "node:path"
import { statSync } from "node:fs"

// `server-only` and the `@/` path alias are both resolved by Next's bundler
// rather than by Node, so they are taught to the test runner here. Without the
// alias, any module under test that imports a sibling the way the rest of the
// codebase does would fail to load.
const projectRoot = pathToFileURL(resolvePath(import.meta.dirname, "..") + "/").href

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export {}", shortCircuit: true }
    }
    if (specifier.startsWith("@/")) {
      // Node needs a real file; the codebase, like Next, imports without an
      // extension. Try the same candidates the bundler would.
      const base = new URL(specifier.slice(2), projectRoot)
      for (const suffix of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const candidate = new URL(base.href + suffix)
        // Must be a *file*: a specifier like `@/lib/db` matches the directory
        // on the bare suffix, and Node cannot import a directory, so a plain
        // existence check would stop on a path that can never load.
        if (statSync(candidate, { throwIfNoEntry: false })?.isFile()) {
          return next(candidate.href, context)
        }
      }
    }
    return next(specifier, context)
  },
})

import { registerHooks } from "node:module"
import { pathToFileURL } from "node:url"
import { resolve as resolvePath } from "node:path"
import { existsSync } from "node:fs"

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
        if (existsSync(candidate)) return next(candidate.href, context)
      }
    }
    return next(specifier, context)
  },
})

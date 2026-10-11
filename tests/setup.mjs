import { registerHooks } from "node:module"

// `server-only` is resolved by Next's bundler, not Node. Stub it so server
// modules can be imported directly by `node --test`.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export {}", shortCircuit: true }
    }
    return next(specifier, context)
  },
})

import "server-only"

import Stripe from "stripe"

let client: Stripe | null = null

function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set")
    }
    client = new Stripe(key)
  }
  return client
}

// Initialised on first use rather than at import time, so modules that merely
// import this one (auth, transactional emails) keep working when Stripe is not
// configured. Only code that actually calls Stripe hits the missing-key error.
export const stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    const instance = getStripe()
    return Reflect.get(instance, property, instance)
  },
})

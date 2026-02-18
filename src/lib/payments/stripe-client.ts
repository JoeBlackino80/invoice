/**
 * Stripe client configuration.
 * Uses real Stripe SDK when STRIPE_SECRET_KEY is set,
 * falls back to simulation mode otherwise.
 */

import Stripe from "stripe"

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null

  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    })
  }

  return stripeInstance
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

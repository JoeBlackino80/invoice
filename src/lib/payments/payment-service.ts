import { generatePayBySquareQR, generatePayBySquareString } from "@/lib/pay-by-square"
import type { PayBySquareData } from "@/lib/pay-by-square"
import { getStripe, isStripeConfigured } from "./stripe-client"

// ---------- Interfaces ----------

export interface PaymentRecord {
  id: string
  invoice_id: string
  amount: number
  currency: string
  method: "stripe" | "gopay" | "bank_transfer" | "cash"
  status: "pending" | "completed" | "failed" | "refunded"
  transaction_id: string | null
  created_at: string
}

export interface PaymentIntent {
  id: string
  client_secret: string
  amount: number
  currency: string
  status: string
  payment_url: string | null
}

export interface GoPayPayment {
  id: string
  gw_url: string
  amount: number
  currency: string
  state: string
}

export interface PaymentStatus {
  id: string
  status: "pending" | "completed" | "failed" | "refunded"
  amount: number
  currency: string
  paid_at: string | null
}

export interface WebhookResult {
  success: boolean
  payment_id: string | null
  invoice_id: string | null
  status: string
  error?: string
}

export interface MatchResult {
  matched: boolean
  invoice_id: string | null
  amount_matched: number
  remaining: number
  invoice_status: string
}

// ---------- Stripe Integration ----------

export async function createStripePaymentIntent(
  amount: number,
  currency: string,
  invoiceId: string,
  companyId: string
): Promise<PaymentIntent> {
  const stripe = getStripe()

  if (stripe) {
    // Real Stripe integration
    const intent = await stripe.paymentIntents.create({
      amount, // already in cents from caller
      currency: currency.toLowerCase(),
      metadata: { invoice_id: invoiceId, company_id: companyId },
      automatic_payment_methods: { enabled: true },
    })

    return {
      id: intent.id,
      client_secret: intent.client_secret!,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status,
      payment_url: null, // client-side handles via Stripe Elements
    }
  }

  // Simulation fallback when STRIPE_SECRET_KEY not set
  const simulatedId = `pi_simulated_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  return {
    id: simulatedId,
    client_secret: `${simulatedId}_secret_${Math.random().toString(36).substring(2, 12)}`,
    amount,
    currency: currency.toLowerCase(),
    status: "requires_payment_method",
    payment_url: `/portal/pay/stripe/${simulatedId}`,
  }
}

/**
 * Create a Stripe Checkout Session for hosted payment page.
 */
export async function createStripeCheckoutSession(
  amount: number,
  currency: string,
  invoiceId: string,
  invoiceNumber: string,
  companyId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string | null; sessionId: string }> {
  const stripe = getStripe()

  if (stripe) {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Faktúra ${invoiceNumber}`,
              description: `Úhrada faktúry ${invoiceNumber}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { invoice_id: invoiceId, company_id: companyId },
    })

    return { url: session.url, sessionId: session.id }
  }

  // Simulation fallback
  return {
    url: `${successUrl}?simulated=true`,
    sessionId: `cs_simulated_${Date.now()}`,
  }
}

/**
 * Verify and construct a Stripe webhook event.
 * Returns null if signature is invalid.
 */
export async function verifyStripeWebhook(
  body: string,
  signature: string | null
): Promise<{ type: string; data: { object: Record<string, any> } } | null> {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (stripe && webhookSecret && signature) {
    try {
      const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      return { type: event.type, data: event.data as any }
    } catch {
      return null
    }
  }

  // Fallback: trust the body (for simulation / dev)
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

export async function handleStripeWebhook(event: {
  type: string
  data: { object: Record<string, any> }
}): Promise<WebhookResult> {
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object
    return {
      success: true,
      payment_id: paymentIntent.id as string || null,
      invoice_id: (paymentIntent.metadata?.invoice_id as string) || null,
      status: "completed",
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object
    return {
      success: true,
      payment_id: paymentIntent.id as string || null,
      invoice_id: (paymentIntent.metadata?.invoice_id as string) || null,
      status: "failed",
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object
    return {
      success: true,
      payment_id: session.payment_intent as string || session.id as string || null,
      invoice_id: (session.metadata?.invoice_id as string) || null,
      status: "completed",
    }
  }

  return {
    success: false,
    payment_id: null,
    invoice_id: null,
    status: "unknown",
    error: `Neznámy typ udalosti: ${event.type}`,
  }
}

// ---------- GoPay Integration (Prepared / Simulated) ----------

export async function createGoPayPayment(
  amount: number,
  currency: string,
  invoiceId: string,
  returnUrl: string
): Promise<GoPayPayment> {
  // Simulated GoPay payment creation
  // In production, this would call GoPay API:
  // const response = await fetch('https://gate.gopay.cz/api/payments/payment', { ... })

  const simulatedId = `gp_simulated_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

  return {
    id: simulatedId,
    gw_url: `https://gw.sandbox.gopay.com/gp-gw/paygate?payment_session_id=${simulatedId}`,
    amount: Math.round(amount * 100), // GoPay uses cents
    currency: currency.toUpperCase(),
    state: "CREATED",
  }
}

export async function checkGoPayStatus(paymentId: string): Promise<PaymentStatus> {
  // Simulated GoPay status check
  // In production: GET https://gate.gopay.cz/api/payments/payment/{id}

  return {
    id: paymentId,
    status: "pending",
    amount: 0,
    currency: "EUR",
    paid_at: null,
  }
}

// ---------- PAY by square ----------

export function generatePayBySquareData(
  iban: string,
  amount: number,
  vs?: string,
  ks?: string,
  ss?: string,
  note?: string
): string {
  const data: PayBySquareData = {
    amount,
    currency: "EUR",
    iban,
    recipientName: "",
    variableSymbol: vs || undefined,
    constantSymbol: ks || undefined,
    specificSymbol: ss || undefined,
    note: note || undefined,
  }

  return generatePayBySquareString(data)
}

export async function generatePayBySquareQRCode(
  iban: string,
  amount: number,
  recipientName: string,
  vs?: string,
  ks?: string,
  ss?: string,
  note?: string,
  dueDate?: string
): Promise<string> {
  const data: PayBySquareData = {
    amount,
    currency: "EUR",
    iban,
    recipientName,
    variableSymbol: vs || undefined,
    constantSymbol: ks || undefined,
    specificSymbol: ss || undefined,
    note: note || undefined,
    dueDate: dueDate || undefined,
  }

  return generatePayBySquareQR(data)
}

// ---------- Payment Link ----------

export function generatePaymentLink(invoiceId: string, companySlug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const token = Buffer.from(`${companySlug}:${invoiceId}:${Date.now()}`).toString("base64url")
  return `${baseUrl}/api/payments/link/${token}`
}

export function createPaymentRecord(
  invoiceId: string,
  amount: number,
  method: PaymentRecord["method"],
  transactionId: string | null
): PaymentRecord {
  return {
    id: crypto.randomUUID(),
    invoice_id: invoiceId,
    amount,
    currency: "EUR",
    method,
    status: "pending",
    transaction_id: transactionId,
    created_at: new Date().toISOString(),
  }
}

export function matchPaymentToInvoice(
  paymentRecord: PaymentRecord,
  invoiceTotal: number,
  alreadyPaid: number
): MatchResult {
  const totalPaidAfter = alreadyPaid + paymentRecord.amount
  const remaining = invoiceTotal - totalPaidAfter

  let invoiceStatus: string
  if (remaining <= 0) {
    invoiceStatus = "uhradena"
  } else if (totalPaidAfter > 0) {
    invoiceStatus = "ciastocne_uhradena"
  } else {
    invoiceStatus = "odoslana"
  }

  return {
    matched: true,
    invoice_id: paymentRecord.invoice_id,
    amount_matched: paymentRecord.amount,
    remaining: Math.max(0, remaining),
    invoice_status: invoiceStatus,
  }
}

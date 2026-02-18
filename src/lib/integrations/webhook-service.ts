// Webhook Service - send, verify, and log webhook deliveries

// ============ Types ============

export interface WebhookConfig {
  id: string
  company_id: string
  url: string
  events: WebhookEventType[]
  secret: string
  is_active: boolean
  created_at: string
  updated_at?: string
  description?: string
}

export type WebhookEventType =
  | "invoice.created"
  | "invoice.paid"
  | "invoice.cancelled"
  | "payment.received"
  | "payment.sent"
  | "journal.posted"
  | "tax.generated"
  | "contact.created"
  | "contact.updated"

export const WEBHOOK_EVENTS: Array<{ value: WebhookEventType; label: string }> = [
  { value: "invoice.created", label: "Faktura vytvorena" },
  { value: "invoice.paid", label: "Faktura uhraden\u00e1" },
  { value: "invoice.cancelled", label: "Faktura stornovan\u00e1" },
  { value: "payment.received", label: "Platba prijat\u00e1" },
  { value: "payment.sent", label: "Platba odoslan\u00e1" },
  { value: "journal.posted", label: "Uctovny z\u00e1pis zauctovan\u00fd" },
  { value: "tax.generated", label: "Danove priznanie vygenerovane" },
  { value: "contact.created", label: "Kontakt vytvoreny" },
  { value: "contact.updated", label: "Kontakt aktualizovany" },
]

export interface WebhookDelivery {
  id: string
  webhook_id: string
  event: string
  payload: any
  status_code: number | null
  response_body: string | null
  response_time_ms: number | null
  retry_count: number
  success: boolean
  error_message: string | null
  delivered_at: string
}

export interface WebhookPayload {
  id: string
  event: WebhookEventType
  timestamp: string
  data: any
}

// ============ Signature Generation ============

export async function generateWebhookSignature(
  payload: string,
  secret: string
): Promise<string> {
  // Use Web Crypto API (works in both Node.js and browser/edge runtime)
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const data = encoder.encode(payload)

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

// ============ Secret Generation ============

export function generateWebhookSecret(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return "whsec_" + Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("")
}

// ============ Send Webhook ============

export async function sendWebhook(
  config: WebhookConfig,
  event: WebhookEventType,
  data: any
): Promise<WebhookDelivery> {
  const deliveryId = crypto.randomUUID()
  const timestamp = new Date().toISOString()

  const payload: WebhookPayload = {
    id: deliveryId,
    event,
    timestamp,
    data,
  }

  const payloadStr = JSON.stringify(payload)
  const signature = await generateWebhookSignature(payloadStr, config.secret)

  const startTime = Date.now()
  let statusCode: number | null = null
  let responseBody: string | null = null
  let errorMessage: string | null = null
  let success = false

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Id": deliveryId,
        "X-Webhook-Event": event,
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Timestamp": timestamp,
        "User-Agent": "InvoiceApp-Webhook/1.0",
      },
      body: payloadStr,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    statusCode = response.status
    responseBody = await response.text().catch(() => null)
    success = response.ok
  } catch (err: any) {
    errorMessage = err.name === "AbortError"
      ? "Casovy limit prekroceny (10s)"
      : `Chyba pripojenia: ${err.message || "unknown"}`
    success = false
  }

  const responseTimeMs = Date.now() - startTime

  const delivery: WebhookDelivery = {
    id: deliveryId,
    webhook_id: config.id,
    event,
    payload,
    status_code: statusCode,
    response_body: responseBody ? responseBody.substring(0, 2000) : null, // Limit stored response
    response_time_ms: responseTimeMs,
    retry_count: 0,
    success,
    error_message: errorMessage,
    delivered_at: timestamp,
  }

  return delivery
}

// ============ Webhook Delivery Log ============

export async function saveDelivery(
  supabase: any,
  delivery: WebhookDelivery
): Promise<void> {
  await (supabase.from("webhook_deliveries") as any).insert({
    id: delivery.id,
    webhook_id: delivery.webhook_id,
    event: delivery.event,
    payload: delivery.payload,
    status_code: delivery.status_code,
    response_body: delivery.response_body,
    response_time_ms: delivery.response_time_ms,
    retry_count: delivery.retry_count,
    success: delivery.success,
    error_message: delivery.error_message,
    delivered_at: delivery.delivered_at,
  })
}

export async function getDeliveryLog(
  supabase: any,
  webhookId: string
): Promise<WebhookDelivery[]> {
  const { data, error } = await (supabase.from("webhook_deliveries") as any)
    .select("*")
    .eq("webhook_id", webhookId)
    .order("delivered_at", { ascending: false })
    .limit(100)

  if (error) return []
  return data || []
}

// ============ Dispatch Webhook to All Matching Configs ============

export async function dispatchWebhook(
  supabase: any,
  companyId: string,
  event: WebhookEventType,
  data: any
): Promise<WebhookDelivery[]> {
  // Find all active webhooks for this company that subscribe to this event
  const { data: configs, error } = await (supabase.from("webhook_configs") as any)
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)

  if (error || !configs) return []

  const deliveries: WebhookDelivery[] = []

  for (const config of configs) {
    // Check if this webhook subscribes to the event
    const events: string[] = Array.isArray(config.events) ? config.events : []
    if (!events.includes(event)) continue

    const delivery = await sendWebhook(config as WebhookConfig, event, data)
    await saveDelivery(supabase, delivery)
    deliveries.push(delivery)
  }

  return deliveries
}

// ============ Verify Webhook Signature ============

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = await generateWebhookSignature(payload, secret)
  const received = signature.replace("sha256=", "")
  return expected === received
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  sendWebhook,
  saveDelivery,
  type WebhookConfig,
} from "@/lib/integrations/webhook-service"

// POST /api/integrations/webhooks/:id/test
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const webhookId = params.id

  if (!webhookId) {
    return NextResponse.json({ error: "ID webhooku je povinne" }, { status: 400 })
  }

  // Fetch webhook config
  const { data: webhook, error: webhookError } = await (db.from("webhook_configs") as any)
    .select("*")
    .eq("id", webhookId)
    .single() as { data: any; error: any }

  if (webhookError || !webhook) {
    return NextResponse.json({ error: "Webhook nenajdeny" }, { status: 404 })
  }

  const config: WebhookConfig = {
    id: webhook.id,
    company_id: webhook.company_id,
    url: webhook.url,
    events: webhook.events || [],
    secret: webhook.secret,
    is_active: webhook.is_active,
    created_at: webhook.created_at,
  }

  // Send test webhook
  const testPayload = {
    message: "Toto je testovaci webhook z Invoice App",
    timestamp: new Date().toISOString(),
    company_id: webhook.company_id,
    test: true,
  }

  const delivery = await sendWebhook(config, "invoice.created", testPayload)

  // Save delivery log
  try {
    await saveDelivery(db, delivery)
  } catch {
    // Log save failure is non-critical
  }

  return NextResponse.json({
    success: delivery.success,
    status_code: delivery.status_code,
    response_time_ms: delivery.response_time_ms,
    error_message: delivery.error_message,
    delivery_id: delivery.id,
  })
}

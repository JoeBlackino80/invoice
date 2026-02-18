import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/integrations/webhooks/:id/deliveries
export async function GET(
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

  // Verify webhook exists
  const { data: webhook, error: webhookError } = await (db.from("webhook_configs") as any)
    .select("id, company_id")
    .eq("id", webhookId)
    .single() as { data: any; error: any }

  if (webhookError || !webhook) {
    return NextResponse.json({ error: "Webhook nenajdeny" }, { status: 404 })
  }

  // Fetch deliveries
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")

  const { data, error } = await (db.from("webhook_deliveries") as any)
    .select("*")
    .eq("webhook_id", webhookId)
    .order("delivered_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Count total deliveries
  const { count } = await (db.from("webhook_deliveries") as any)
    .select("*", { count: "exact", head: true })
    .eq("webhook_id", webhookId) as { count: number | null }

  return NextResponse.json({
    deliveries: data || [],
    total: count || 0,
    limit,
    offset,
  })
}

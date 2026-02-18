import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateWebhookSecret } from "@/lib/integrations/webhook-service"

// GET /api/integrations/webhooks
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const { data, error } = await (db.from("webhook_configs") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

// POST /api/integrations/webhooks
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  try {
    const body = await request.json()
    const { company_id, url, events, description } = body

    if (!company_id || !url || !events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "company_id, url a events su povinne" },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: "Neplatna URL adresa" }, { status: 400 })
    }

    const secret = generateWebhookSecret()

    const { data, error } = await (db.from("webhook_configs") as any)
      .insert({
        company_id,
        url,
        events,
        secret,
        is_active: true,
        description: description || null,
        created_by: user.id,
      })
      .select()
      .single() as { data: any; error: any }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json(
      { error: `Chyba pri vytvarani webhooku: ${err.message || "unknown"}` },
      { status: 500 }
    )
  }
}

// PUT /api/integrations/webhooks
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  try {
    const body = await request.json()
    const { id, url, events, is_active, description } = body

    if (!id) {
      return NextResponse.json({ error: "ID webhooku je povinne" }, { status: 400 })
    }

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    if (url !== undefined) {
      try {
        new URL(url)
      } catch {
        return NextResponse.json({ error: "Neplatna URL adresa" }, { status: 400 })
      }
      updateData.url = url
    }
    if (events !== undefined) updateData.events = events
    if (is_active !== undefined) updateData.is_active = is_active
    if (description !== undefined) updateData.description = description

    const { data, error } = await (db.from("webhook_configs") as any)
      .update(updateData)
      .eq("id", id)
      .select()
      .single() as { data: any; error: any }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json(
      { error: `Chyba pri aktualizacii webhooku: ${err.message || "unknown"}` },
      { status: 500 }
    )
  }
}

// DELETE /api/integrations/webhooks
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "ID webhooku je povinne" }, { status: 400 })
  }

  const { error } = await (db.from("webhook_configs") as any)
    .delete()
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

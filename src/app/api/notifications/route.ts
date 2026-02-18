import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createNotification } from "@/lib/notifications/notification-service"

// GET /api/notifications - zoznam notifikácií pre aktuálneho používateľa
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const isRead = searchParams.get("is_read")
  const type = searchParams.get("type")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  let query = (db.from("notifications") as any)
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (isRead === "true") {
    query = query.eq("is_read", true)
  } else if (isRead === "false") {
    query = query.eq("is_read", false)
  }

  if (type) {
    query = query.eq("type", type)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/notifications - vytvorenie notifikácie (admin/systém)
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, user_id, type, title, message, link } = body

  if (!company_id || !type || !title || !message) {
    return NextResponse.json(
      { error: "Povinné polia: company_id, type, title, message" },
      { status: 400 }
    )
  }

  try {
    const notification = await createNotification(db, {
      company_id,
      user_id: user_id || user.id,
      type,
      title,
      message,
      link: link || undefined,
      is_read: false,
    })

    return NextResponse.json(notification, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT /api/notifications - označenie notifikácií ako prečítané
export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { notification_ids, all, company_id } = body

  if (all && company_id) {
    // Označiť všetky ako prečítané
    const { error } = await (db.from("notifications") as any)
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .eq("is_read", false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Všetky notifikácie označené ako prečítané" })
  }

  if (notification_ids && Array.isArray(notification_ids) && notification_ids.length > 0) {
    const { error } = await (db.from("notifications") as any)
      .update({ is_read: true })
      .eq("user_id", user.id)
      .in("id", notification_ids)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Notifikácie označené ako prečítané" })
  }

  return NextResponse.json(
    { error: "Zadajte notification_ids alebo all: true s company_id" },
    { status: 400 }
  )
}

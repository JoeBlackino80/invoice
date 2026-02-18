import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Pomocná funkcia na overenie portál tokenu
async function verifyPortalToken(db: any, token: string) {
  const { data, error } = await (db
    .from("portal_tokens") as any)
    .select("id, contact_id, company_id, expires_at")
    .eq("token", token)
    .single() as { data: any; error: any }

  if (error || !data) return null
  if (new Date(data.expires_at) < new Date()) return null

  return data
}

// GET /api/portal/invoices - Zoznam faktúr pre portál kontakt
export async function GET(request: Request) {
  const supabase = createClient()
  const db = createAdminClient()

  const portalToken = request.headers.get("x-portal-token")
  if (!portalToken) {
    return NextResponse.json({ error: "Chýba prístupový token" }, { status: 401 })
  }

  const session = await verifyPortalToken(db, portalToken)
  if (!session) {
    return NextResponse.json({ error: "Neplatný alebo expirovaný token" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  // Načítať faktúry vydané pre tento kontakt
  let query = (db
    .from("invoices") as any)
    .select("id, number, issue_date, delivery_date, due_date, total_amount, total_with_vat, currency, status, variable_symbol, type", { count: "exact" })
    .eq("company_id", session.company_id)
    .eq("contact_id", session.contact_id)
    .eq("type", "vydana")
    .is("deleted_at", null)
    .neq("status", "draft") // Nezobrazovať drafty
    .order("issue_date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (status === "uhradena") {
    query = query.eq("status", "uhradena")
  } else if (status === "neuhradena") {
    query = query.in("status", ["odoslana", "ciastocne_uhradena"])
  } else if (status === "po_splatnosti") {
    query = query.eq("status", "po_splatnosti")
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

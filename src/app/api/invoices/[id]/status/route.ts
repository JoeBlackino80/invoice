import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// PUT /api/invoices/:id/status - zmena stavu faktúry
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { status } = body

  const validStatuses = ["draft", "odoslana", "uhradena", "ciastocne_uhradena", "po_splatnosti", "stornovana"]
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Neplatný stav" }, { status: 400 })
  }

  // Fetch current invoice
  const { data: invoice, error: fetchError } = await db
    .from("invoices")
    .select("status, type")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !invoice) {
    return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 })
  }

  // Validate status transitions
  const allowedTransitions: Record<string, string[]> = {
    draft: ["odoslana", "stornovana"],
    odoslana: ["uhradena", "ciastocne_uhradena", "po_splatnosti", "stornovana"],
    ciastocne_uhradena: ["uhradena", "po_splatnosti", "stornovana"],
    po_splatnosti: ["uhradena", "ciastocne_uhradena", "stornovana"],
    uhradena: [],
    stornovana: [],
  }

  const allowed = allowedTransitions[invoice.status] || []
  if (!allowed.includes(status)) {
    return NextResponse.json({
      error: `Nemožno zmeniť stav z '${invoice.status}' na '${status}'`
    }, { status: 400 })
  }

  const { data, error } = await (db
    .from("invoices") as any)
    .update({ status, updated_by: user.id })
    .eq("id", params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

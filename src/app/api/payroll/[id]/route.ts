import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/payroll/:id - detail výplatnej listiny
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { data: payrollRun, error: runError } = await (db.from("payroll_runs") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (runError) {
    return NextResponse.json({ error: "Výplatná listina nenájdená" }, { status: 404 })
  }

  const { data: items, error: itemsError } = await (db.from("payroll_items") as any)
    .select("*")
    .eq("payroll_run_id", params.id)
    .order("employee_name", { ascending: true })

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json({
    ...payrollRun,
    items: items || [],
  })
}

// PUT /api/payroll/:id - aktualizácia stavu výplatnej listiny
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

  if (!status || !["draft", "approved", "paid"].includes(status)) {
    return NextResponse.json(
      { error: "Neplatný stav. Povolené hodnoty: draft, approved, paid" },
      { status: 400 }
    )
  }

  // Check existing record
  const { data: existing, error: fetchError } = await (db.from("payroll_runs") as any)
    .select("status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError) {
    return NextResponse.json({ error: "Výplatná listina nenájdená" }, { status: 404 })
  }

  // Validate status transition
  const validTransitions: Record<string, string[]> = {
    draft: ["approved"],
    approved: ["paid", "draft"],
    paid: [],
  }

  if (!validTransitions[existing.status]?.includes(status)) {
    return NextResponse.json(
      { error: `Nie je možné zmeniť stav z '${existing.status}' na '${status}'` },
      { status: 400 }
    )
  }

  const updateData: any = {
    status,
    updated_by: user.id,
  }

  if (status === "paid") {
    updateData.paid_at = new Date().toISOString()
  }

  if (status === "approved") {
    updateData.approved_at = new Date().toISOString()
    updateData.approved_by = user.id
  }

  const { data: updated, error: updateError } = await (db.from("payroll_runs") as any)
    .update(updateData)
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}

// DELETE /api/payroll/:id - soft delete výplatnej listiny (iba draft)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { data: existing, error: fetchError } = await (db.from("payroll_runs") as any)
    .select("status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError) {
    return NextResponse.json({ error: "Výplatná listina nenájdená" }, { status: 404 })
  }

  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "Možno odstrániť iba výplatnú listinu v stave 'draft'" },
      { status: 400 }
    )
  }

  const { error } = await (db.from("payroll_runs") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

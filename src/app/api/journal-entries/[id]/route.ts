import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { journalEntrySchema } from "@/lib/validations/journal"
import { checkPeriodLock } from "@/lib/accounting/period-lock-check"

// GET /api/journal-entries/:id - detail uctovneho zapisu
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { data, error } = await (db
    .from("journal_entries") as any)
    .select(`
      *,
      lines:journal_entry_lines(
        id,
        position,
        account_id,
        side,
        amount,
        amount_currency,
        currency,
        exchange_rate,
        cost_center_id,
        project_id,
        description,
        account:chart_of_accounts(id, synteticky_ucet, analyticky_ucet, nazov)
      )
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .order("position", { foreignTable: "journal_entry_lines", ascending: true })
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: "Uctovny zapis nebol najdeny" }, { status: 404 })
  }

  return NextResponse.json(data)
}

// PUT /api/journal-entries/:id - uprava uctovneho zapisu (len draft)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Check if entry exists and is in draft status
  const { data: existing, error: fetchError } = await (db
    .from("journal_entries") as any)
    .select("status, company_id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError) {
    return NextResponse.json({ error: "Uctovny zapis nebol najdeny" }, { status: 404 })
  }

  if (existing.status !== "draft") {
    return NextResponse.json({
      error: "Mozno upravovat iba zapisy v stave 'draft'"
    }, { status: 400 })
  }

  const body = await request.json()
  const parsed = journalEntrySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Check period lock
  const lockResponse = await checkPeriodLock(db, existing.company_id, parsed.data.date)
  if (lockResponse) return lockResponse

  // Validate MD sum = D sum
  const mdSum = parsed.data.lines
    .filter((l) => l.side === "MD")
    .reduce((sum, l) => sum + l.amount, 0)
  const dSum = parsed.data.lines
    .filter((l) => l.side === "D")
    .reduce((sum, l) => sum + l.amount, 0)

  if (Math.abs(mdSum - dSum) > 0.005) {
    return NextResponse.json({
      error: "Uctovny zapis nie je vyrovnany. Suma MD (" + mdSum.toFixed(2) + ") sa nerovna sume D (" + dSum.toFixed(2) + ")"
    }, { status: 400 })
  }

  const { lines, ...headerData } = parsed.data

  // Update journal entry header
  const { data: updatedEntry, error: updateError } = await (db
    .from("journal_entries") as any)
    .update({
      document_type: headerData.document_type,
      date: headerData.date,
      description: headerData.description,
      source_invoice_id: headerData.source_invoice_id || null,
      source_document_id: headerData.source_document_id || null,
      total_md: mdSum,
      total_d: dSum,
      updated_by: user.id,
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Delete existing lines
  const { error: deleteLinesError } = await (db
    .from("journal_entry_lines") as any)
    .delete()
    .eq("journal_entry_id", params.id)

  if (deleteLinesError) {
    return NextResponse.json({ error: deleteLinesError.message }, { status: 500 })
  }

  // Re-insert lines
  const linesToInsert = lines.map((line, index) => ({
    company_id: existing.company_id,
    journal_entry_id: params.id,
    position: index,
    account_id: line.account_id,
    side: line.side,
    amount: line.amount,
    amount_currency: line.amount_currency || null,
    currency: line.currency || "EUR",
    exchange_rate: line.exchange_rate || null,
    cost_center_id: line.cost_center_id || null,
    project_id: line.project_id || null,
    description: line.description || null,
  }))

  const { data: insertedLines, error: linesError } = await (db
    .from("journal_entry_lines") as any)
    .insert(linesToInsert)
    .select()

  if (linesError) {
    return NextResponse.json({ error: linesError.message }, { status: 500 })
  }

  return NextResponse.json({
    ...updatedEntry,
    lines: insertedLines,
  })
}

// DELETE /api/journal-entries/:id - soft delete (len draft)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Check if entry exists and is in draft status
  const { data: existing, error: fetchError } = await (db
    .from("journal_entries") as any)
    .select("status, company_id, date")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError) {
    return NextResponse.json({ error: "Uctovny zapis nebol najdeny" }, { status: 404 })
  }

  if (existing.status !== "draft") {
    return NextResponse.json({
      error: "Mozno odstranit iba zapisy v stave 'draft'"
    }, { status: 400 })
  }

  // Check period lock
  const lockResponse = await checkPeriodLock(db, existing.company_id, existing.date)
  if (lockResponse) return lockResponse

  const { error } = await (db
    .from("journal_entries") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

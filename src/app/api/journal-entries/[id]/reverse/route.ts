import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/journal-entries/:id/reverse - stornovanie (vytvorenie opacneho zapisu)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Get the original journal entry with lines
  const { data: original, error: fetchError } = await (db
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
        description
      )
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError) {
    return NextResponse.json({ error: "Uctovny zapis nebol najdeny" }, { status: 404 })
  }

  if (original.status !== "posted") {
    return NextResponse.json({
      error: "Stornovat mozno iba zauctovane zapisy (stav 'posted')"
    }, { status: 400 })
  }

  const originalLines = original.lines || []
  if (originalLines.length === 0) {
    return NextResponse.json({
      error: "Povodny zapis nema ziadne riadky"
    }, { status: 400 })
  }

  // Generate document number for reversal
  const sequenceTypeMap: Record<string, string> = {
    FA: "uctovny_zapis_FA",
    PFA: "uctovny_zapis_PFA",
    ID: "uctovny_zapis_ID",
    BV: "uctovny_zapis_BV",
    PPD: "uctovny_zapis_PPD",
    VPD: "uctovny_zapis_VPD",
  }

  const sequenceType = sequenceTypeMap[original.document_type] || "uctovny_zapis_ID"

  const { data: documentNumber, error: numberError } = await (db
    .rpc as any)("generate_next_number", {
      p_company_id: original.company_id,
      p_type: sequenceType,
    })

  if (numberError) {
    return NextResponse.json({ error: numberError.message }, { status: 500 })
  }

  // Calculate totals for reversed entry (swapped sides)
  const mdSum = originalLines
    .filter((l: any) => l.side === "D") // original D becomes new MD
    .reduce((sum: number, l: any) => sum + Number(l.amount), 0)
  const dSum = originalLines
    .filter((l: any) => l.side === "MD") // original MD becomes new D
    .reduce((sum: number, l: any) => sum + Number(l.amount), 0)

  // Create the reversing entry
  const { data: reversal, error: reversalError } = await (db
    .from("journal_entries") as any)
    .insert({
      company_id: original.company_id,
      number: documentNumber,
      document_type: original.document_type,
      date: new Date().toISOString().split("T")[0],
      description: "STORNO: " + original.description + " (povodny doklad: " + original.number + ")",
      source_document_id: original.id,
      status: "posted",
      total_md: mdSum,
      total_d: dSum,
      posted_at: new Date().toISOString(),
      posted_by: user.id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (reversalError) {
    return NextResponse.json({ error: reversalError.message }, { status: 500 })
  }

  // Create reversed lines (swap MD/D sides)
  const reversedLines = originalLines.map((line: any, index: number) => ({
    company_id: original.company_id,
    journal_entry_id: reversal.id,
    position: index,
    account_id: line.account_id,
    side: line.side === "MD" ? "D" : "MD",
    amount: Number(line.amount),
    amount_currency: line.amount_currency ? Number(line.amount_currency) : null,
    currency: line.currency || "EUR",
    exchange_rate: line.exchange_rate ? Number(line.exchange_rate) : null,
    cost_center_id: line.cost_center_id || null,
    project_id: line.project_id || null,
    description: line.description ? "STORNO: " + line.description : "STORNO",
  }))

  const { data: insertedLines, error: linesError } = await (db
    .from("journal_entry_lines") as any)
    .insert(reversedLines)
    .select()

  if (linesError) {
    // Rollback: delete the reversal entry
    await (db.from("journal_entries") as any).delete().eq("id", reversal.id)
    return NextResponse.json({ error: linesError.message }, { status: 500 })
  }

  return NextResponse.json({
    ...reversal,
    lines: insertedLines,
  }, { status: 201 })
}

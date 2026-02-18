import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { journalEntrySchema } from "@/lib/validations/journal"
import { checkPeriodLock } from "@/lib/accounting/period-lock-check"

// GET /api/journal-entries - zoznam uctovnych zapisov
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const documentType = searchParams.get("document_type")
  const status = searchParams.get("status")
  const search = searchParams.get("search")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  let query = (db.from("journal_entries") as any)
    .select(`
      *,
      lines:journal_entry_lines(
        id,
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
    `, { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (documentType) {
    query = query.eq("document_type", documentType)
  }

  if (status) {
    query = query.eq("status", status)
  }

  if (search) {
    query = query.or(`number.ilike.%${search}%,description.ilike.%${search}%`)
  }

  if (dateFrom) {
    query = query.gte("date", dateFrom)
  }

  if (dateTo) {
    query = query.lte("date", dateTo)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/journal-entries - vytvorenie uctovneho zapisu
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...entryData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const parsed = journalEntrySchema.safeParse(entryData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Check period lock
  const lockResponse = await checkPeriodLock(db, company_id, parsed.data.date)
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

  // Map document type to sequence type
  const sequenceTypeMap: Record<string, string> = {
    FA: "uctovny_zapis_FA",
    PFA: "uctovny_zapis_PFA",
    ID: "uctovny_zapis_ID",
    BV: "uctovny_zapis_BV",
    PPD: "uctovny_zapis_PPD",
    VPD: "uctovny_zapis_VPD",
  }

  const sequenceType = sequenceTypeMap[parsed.data.document_type] || "uctovny_zapis_ID"

  // Generate document number
  const { data: documentNumber, error: numberError } = await (db
    .rpc as any)("generate_next_number", {
      p_company_id: company_id,
      p_type: sequenceType,
    })

  if (numberError) {
    return NextResponse.json({ error: numberError.message }, { status: 500 })
  }

  // Extract lines
  const { lines, ...headerData } = parsed.data

  // Insert journal entry header
  const { data: entry, error: entryError } = await (db
    .from("journal_entries") as any)
    .insert({
      company_id,
      number: documentNumber,
      document_type: headerData.document_type,
      date: headerData.date,
      description: headerData.description,
      source_invoice_id: headerData.source_invoice_id || null,
      source_document_id: headerData.source_document_id || null,
      status: "draft",
      total_md: mdSum,
      total_d: dSum,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (entryError) {
    return NextResponse.json({ error: entryError.message }, { status: 500 })
  }

  // Insert journal entry lines
  const linesToInsert = lines.map((line, index) => ({
    company_id,
    journal_entry_id: entry.id,
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
    // Rollback: delete the entry
    await (db.from("journal_entries") as any).delete().eq("id", entry.id)
    return NextResponse.json({ error: linesError.message }, { status: 500 })
  }

  return NextResponse.json({
    ...entry,
    lines: insertedLines,
  }, { status: 201 })
}

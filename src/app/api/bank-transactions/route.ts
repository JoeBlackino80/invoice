import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/bank-transactions - zoznam bankovych transakcii
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const bankAccountId = searchParams.get("bank_account_id")
  const bankStatementId = searchParams.get("bank_statement_id")
  const companyId = searchParams.get("company_id")
  const status = searchParams.get("status")
  const type = searchParams.get("type")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const search = searchParams.get("search")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId && !bankAccountId && !bankStatementId) {
    return NextResponse.json({ error: "company_id, bank_account_id alebo bank_statement_id je povinny" }, { status: 400 })
  }

  let query = (db.from("bank_transactions") as any)
    .select(
      "*, bank_account:bank_accounts(id, name, iban, currency), invoice:invoices(id, number, total_amount)",
      { count: "exact" }
    )
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (bankAccountId) {
    query = query.eq("bank_account_id", bankAccountId)
  }

  if (bankStatementId) {
    query = query.eq("bank_statement_id", bankStatementId)
  }

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  if (status && status !== "vsetky") {
    query = query.eq("status", status)
  }

  if (type && type !== "vsetky") {
    query = query.eq("type", type)
  }

  if (dateFrom) {
    query = query.gte("date", dateFrom)
  }

  if (dateTo) {
    query = query.lte("date", dateTo)
  }

  if (search) {
    query = query.or(
      `counterparty_name.ilike.%${search}%,counterparty_iban.ilike.%${search}%,variable_symbol.ilike.%${search}%,description.ilike.%${search}%,reference.ilike.%${search}%`
    )
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

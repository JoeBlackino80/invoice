import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { bankStatementSchema } from "@/lib/validations/bank"

// GET /api/bank-statements - zoznam bankovych vypisov
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const bankAccountId = searchParams.get("bank_account_id")
  const companyId = searchParams.get("company_id")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId && !bankAccountId) {
    return NextResponse.json({ error: "company_id alebo bank_account_id je povinny" }, { status: 400 })
  }

  let query = (db.from("bank_statements") as any)
    .select("*, bank_account:bank_accounts(id, name, iban, currency)", { count: "exact" })
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (bankAccountId) {
    query = query.eq("bank_account_id", bankAccountId)
  }

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get transaction count for each statement
  const statementsWithCounts = await Promise.all(
    (data || []).map(async (statement: any) => {
      const { count: txCount } = await (db.from("bank_transactions") as any)
        .select("id", { count: "exact", head: true })
        .eq("bank_statement_id", statement.id)
        .is("deleted_at", null)

      return {
        ...statement,
        transaction_count: txCount || 0,
      }
    })
  )

  return NextResponse.json({
    data: statementsWithCounts,
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/bank-statements - vytvorenie hlavicky vypisu
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...statementData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const parsed = bankStatementSchema.safeParse(statementData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Verify the bank account exists
  const { data: account, error: accError } = await (db.from("bank_accounts") as any)
    .select("id")
    .eq("id", parsed.data.bank_account_id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (accError || !account) {
    return NextResponse.json({ error: "Bankovy ucet nenajdeny" }, { status: 404 })
  }

  const { data, error } = await (db.from("bank_statements") as any)
    .insert({
      ...parsed.data,
      company_id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

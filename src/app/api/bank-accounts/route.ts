import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { bankAccountSchema } from "@/lib/validations/bank"

// GET /api/bank-accounts - zoznam bankovych uctov
export async function GET(request: Request) {
  const supabase = createClient()
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

  const { data: accounts, error } = await (db.from("bank_accounts") as any)
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Calculate current balance for each account from transactions
  const accountsWithBalance = await Promise.all(
    (accounts || []).map(async (account: any) => {
      const { data: transactions } = await (db.from("bank_transactions") as any)
        .select("amount")
        .eq("bank_account_id", account.id)
        .is("deleted_at", null)

      let balance = account.opening_balance || 0
      if (transactions) {
        for (const tx of transactions) {
          balance += tx.amount // amount is already signed: positive=credit, negative=debit
        }
      }

      // Count unmatched transactions
      const { count: unmatchedCount } = await (db.from("bank_transactions") as any)
        .select("id", { count: "exact", head: true })
        .eq("bank_account_id", account.id)
        .eq("status", "neparovana")
        .is("deleted_at", null)

      return {
        ...account,
        current_balance: balance,
        unmatched_count: unmatchedCount || 0,
      }
    })
  )

  return NextResponse.json({ data: accountsWithBalance })
}

// POST /api/bank-accounts - vytvorenie bankoveho uctu
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...accountData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const parsed = bankAccountSchema.safeParse(accountData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await (db.from("bank_accounts") as any)
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

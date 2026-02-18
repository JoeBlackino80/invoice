import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/cash-register/book - Pokladnicna kniha
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const cashRegisterId = searchParams.get("cash_register_id")
  const companyId = searchParams.get("company_id")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")

  if (!cashRegisterId) {
    return NextResponse.json({ error: "cash_register_id je povinny" }, { status: 400 })
  }

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  // Get cash register details
  const { data: register, error: regError } = await (db.from("cash_registers") as any)
    .select("*")
    .eq("id", cashRegisterId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (regError || !register) {
    return NextResponse.json({ error: "Pokladna nenajdena" }, { status: 404 })
  }

  const initialBalance = register.initial_balance || 0

  // Calculate opening balance: initial balance + all transactions before date_from
  let openingBalance = initialBalance

  if (dateFrom) {
    const { data: priorTx } = await (db.from("cash_transactions") as any)
      .select("type, amount")
      .eq("cash_register_id", cashRegisterId)
      .is("deleted_at", null)
      .lt("date", dateFrom)

    if (priorTx) {
      for (const tx of priorTx) {
        if (tx.type === "prijem") {
          openingBalance += tx.amount
        } else {
          openingBalance -= tx.amount
        }
      }
    }
  }

  // Fetch transactions in the period
  let query = (db.from("cash_transactions") as any)
    .select("*")
    .eq("cash_register_id", cashRegisterId)
    .is("deleted_at", null)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })

  if (dateFrom) {
    query = query.gte("date", dateFrom)
  }

  if (dateTo) {
    query = query.lte("date", dateTo)
  }

  const { data: transactions, error: txError } = await query

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 })
  }

  // Compute running balance and totals
  let runningBalance = openingBalance
  let totalIncome = 0
  let totalExpense = 0

  const entries = (transactions || []).map((tx: any) => {
    const income = tx.type === "prijem" ? tx.amount : 0
    const expense = tx.type === "vydaj" ? tx.amount : 0

    totalIncome += income
    totalExpense += expense

    if (tx.type === "prijem") {
      runningBalance += tx.amount
    } else {
      runningBalance -= tx.amount
    }

    return {
      id: tx.id,
      document_number: tx.document_number,
      date: tx.date,
      type: tx.type,
      purpose: tx.purpose,
      person: tx.person,
      income,
      expense,
      balance: runningBalance,
    }
  })

  const closingBalance = runningBalance

  return NextResponse.json({
    register: {
      id: register.id,
      name: register.name,
      currency: register.currency,
      account_number: register.account_number,
    },
    period: {
      date_from: dateFrom,
      date_to: dateTo,
    },
    opening_balance: openingBalance,
    closing_balance: closingBalance,
    total_income: totalIncome,
    total_expense: totalExpense,
    entries,
  })
}

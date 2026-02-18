import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cashTransactionSchema } from "@/lib/validations/cash-register"

// GET /api/cash-transactions - zoznam pokladnicnych transakcii
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
  const type = searchParams.get("type")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const search = searchParams.get("search")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId && !cashRegisterId) {
    return NextResponse.json({ error: "company_id alebo cash_register_id je povinny" }, { status: 400 })
  }

  // Build the query for counting and fetching
  let query = (db.from("cash_transactions") as any)
    .select("*, cash_register:cash_registers(id, name, currency, initial_balance)", { count: "exact" })
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (cashRegisterId) {
    query = query.eq("cash_register_id", cashRegisterId)
  }

  if (companyId) {
    query = query.eq("company_id", companyId)
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
    query = query.or(`document_number.ilike.%${search}%,purpose.ilike.%${search}%,person.ilike.%${search}%`)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Calculate running balance for each transaction
  // We need all prior transactions for the same cash register to compute running balance
  const transactionsWithBalance = []
  if (data && data.length > 0) {
    // Group transactions by cash_register_id
    const registerIds = Array.from(new Set(data.map((tx: any) => tx.cash_register_id))) as string[]

    // For each register, get the initial balance and all transactions before the current page
    const balanceMap: Record<string, number> = {}

    for (const regId of registerIds) {
      // Get register initial balance
      const { data: register } = await (db.from("cash_registers") as any)
        .select("initial_balance")
        .eq("id", regId)
        .single() as { data: any; error: any }

      const initialBalance = register?.initial_balance || 0

      // Get all transactions for this register to compute running balance
      const { data: allTx } = await (db.from("cash_transactions") as any)
        .select("id, type, amount, date, created_at")
        .eq("cash_register_id", regId)
        .is("deleted_at", null)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true })

      let running = initialBalance
      const balances: Record<string, number> = {}
      if (allTx) {
        for (const tx of allTx) {
          if (tx.type === "prijem") {
            running += tx.amount
          } else {
            running -= tx.amount
          }
          balances[tx.id] = running
        }
      }
      balanceMap[regId as string] = initialBalance
      // Store individual balances
      for (const tx of data) {
        if (tx.cash_register_id === regId) {
          (tx as any).running_balance = balances[tx.id] ?? initialBalance
        }
      }
    }

    for (const tx of data) {
      transactionsWithBalance.push(tx)
    }
  }

  return NextResponse.json({
    data: transactionsWithBalance,
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/cash-transactions - vytvorenie transakcie
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...txData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const parsed = cashTransactionSchema.safeParse(txData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Get the cash register to verify it exists and get balance info
  const { data: register, error: regError } = await (db.from("cash_registers") as any)
    .select("*")
    .eq("id", parsed.data.cash_register_id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (regError || !register) {
    return NextResponse.json({ error: "Pokladna nenajdena" }, { status: 404 })
  }

  // Calculate current balance
  const { data: existingTx } = await (db.from("cash_transactions") as any)
    .select("type, amount")
    .eq("cash_register_id", parsed.data.cash_register_id)
    .is("deleted_at", null)

  let currentBalance = register.initial_balance || 0
  if (existingTx) {
    for (const tx of existingTx) {
      if (tx.type === "prijem") {
        currentBalance += tx.amount
      } else {
        currentBalance -= tx.amount
      }
    }
  }

  // Validate sufficient balance for vydaj
  if (parsed.data.type === "vydaj" && currentBalance < parsed.data.amount) {
    return NextResponse.json(
      { error: "Nedostatocny zostatok v pokladni. Aktualny zostatok: " + currentBalance.toFixed(2) + " " + register.currency },
      { status: 400 }
    )
  }

  // Generate document number using RPC
  const docType = parsed.data.type === "prijem" ? "ppd" : "vpd"
  const { data: documentNumber, error: numberError } = await (db
    .rpc as any)("generate_next_number", {
      p_company_id: company_id,
      p_type: docType,
    })

  if (numberError) {
    return NextResponse.json({ error: numberError.message }, { status: 500 })
  }

  // Format document number: PPD-001 or VPD-001
  const prefix = parsed.data.type === "prijem" ? "PPD" : "VPD"
  const formattedNumber = documentNumber
    ? `${prefix}-${String(documentNumber).padStart(3, "0")}`
    : `${prefix}-${Date.now()}`

  const { data, error } = await (db.from("cash_transactions") as any)
    .insert({
      ...parsed.data,
      company_id,
      document_number: formattedNumber,
      person: parsed.data.person || null,
      invoice_id: parsed.data.invoice_id || null,
      notes: parsed.data.notes || null,
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

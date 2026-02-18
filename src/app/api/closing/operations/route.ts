import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { closingOperationSchema } from "@/lib/validations/closing"
import { getClosingChecklist, getChecklistProgress } from "@/lib/closing/checklist"
import {
  closeRevenueAccounts,
  closeExpenseAccounts,
  closeProfitLossAccount,
  generateOpeningBalances,
} from "@/lib/closing/operations"

// POST /api/closing/operations - Vykonanie uzavierkovej operacie
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()

  const parsed = closingOperationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { type, fiscal_year_id, company_id } = parsed.data
  const fiscalYearStart = body.fiscal_year_start
  const fiscalYearEnd = body.fiscal_year_end

  if (!fiscalYearStart || !fiscalYearEnd) {
    return NextResponse.json({ error: "fiscal_year_start a fiscal_year_end su povinne" }, { status: 400 })
  }

  // Validate checklist is sufficiently complete before allowing closing operations
  try {
    const checklist = await getClosingChecklist(company_id, fiscal_year_id, db)
    const progress = getChecklistProgress(checklist)

    // For closing operations, at least 70% of the checklist must be complete
    // or all required items must be done
    if (progress.percentage < 70 && !progress.isComplete) {
      return NextResponse.json({
        error: `Checklist nie je dostatocne kompletny (${progress.percentage}%). Pred uzavierkovymi operaciami musia byt splnene minimalne vsetky povinne polozky.`,
        progress,
      }, { status: 400 })
    }
  } catch {
    // If we can't load the checklist, proceed anyway with a warning
  }

  // Check if this operation was already executed
  const { data: existingOp } = await (db.from("closing_operations") as any)
    .select("id, journal_entry_id")
    .eq("company_id", company_id)
    .eq("fiscal_year_id", fiscal_year_id)
    .eq("type", type)
    .is("deleted_at", null)
    .limit(1)

  if (existingOp && existingOp.length > 0) {
    return NextResponse.json({
      error: `Uzavierkova operacia '${type}' uz bola vykonana pre toto obdobie.`,
      existing: existingOp[0],
    }, { status: 409 })
  }

  // Enforce operation order
  if (type === "profit_loss_close") {
    // P&L close requires revenue and expense close to be done first
    const { data: revenueOp } = await (db.from("closing_operations") as any)
      .select("id")
      .eq("company_id", company_id)
      .eq("fiscal_year_id", fiscal_year_id)
      .eq("type", "revenue_close")
      .is("deleted_at", null)
      .limit(1)

    const { data: expenseOp } = await (db.from("closing_operations") as any)
      .select("id")
      .eq("company_id", company_id)
      .eq("fiscal_year_id", fiscal_year_id)
      .eq("type", "expense_close")
      .is("deleted_at", null)
      .limit(1)

    if (!revenueOp || revenueOp.length === 0 || !expenseOp || expenseOp.length === 0) {
      return NextResponse.json({
        error: "Pred uzavretim vysledkoveho uctu musia byt uzavrete vynosove a nakladove ucty.",
      }, { status: 400 })
    }
  }

  if (type === "balance_close") {
    // Balance close requires P&L close to be done first
    const { data: plOp } = await (db.from("closing_operations") as any)
      .select("id")
      .eq("company_id", company_id)
      .eq("fiscal_year_id", fiscal_year_id)
      .eq("type", "profit_loss_close")
      .is("deleted_at", null)
      .limit(1)

    if (!plOp || plOp.length === 0) {
      return NextResponse.json({
        error: "Pred generovanim pociatocnych stavov musi byt uzavrety vysledkovy ucet.",
      }, { status: 400 })
    }
  }

  // Execute the closing operation
  let result

  switch (type) {
    case "revenue_close":
      result = await closeRevenueAccounts(
        company_id, fiscal_year_id, fiscalYearStart, fiscalYearEnd, user.id, db)
      break
    case "expense_close":
      result = await closeExpenseAccounts(
        company_id, fiscal_year_id, fiscalYearStart, fiscalYearEnd, user.id, db)
      break
    case "profit_loss_close":
      result = await closeProfitLossAccount(
        company_id, fiscal_year_id, fiscalYearStart, fiscalYearEnd, user.id, db)
      break
    case "balance_close":
      result = await generateOpeningBalances(
        company_id, fiscal_year_id, fiscalYearStart, fiscalYearEnd, user.id, db)
      break
    default:
      return NextResponse.json({ error: "Neznamy typ operacie" }, { status: 400 })
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  // Record the closing operation
  await (db.from("closing_operations") as any)
    .insert({
      company_id,
      fiscal_year_id,
      type,
      journal_entry_id: result.journalEntryId || null,
      total_amount: result.totalAmount || 0,
      accounts_count: result.accountsCount || 0,
      created_by: user.id,
    })

  return NextResponse.json({
    success: true,
    journal_entry_id: result.journalEntryId,
    total_amount: result.totalAmount,
    accounts_count: result.accountsCount,
    type,
  }, { status: 201 })
}

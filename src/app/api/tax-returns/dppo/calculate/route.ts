import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateDPPO } from "@/lib/tax/income-tax-calculator"

// POST /api/tax-returns/dppo/calculate - Vypocitat dan z prijmov pravnickych osob
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, year, adjustments } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!year) {
    return NextResponse.json({ error: "year je povinny" }, { status: 400 })
  }

  const dateFrom = `${year}-01-01`
  const dateTo = `${year}-12-31`

  // Fetch company info
  const { data: company, error: companyError } = await (db.from("companies") as any)
    .select("id, name, business_type, size_category, is_vat_payer")
    .eq("id", company_id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (companyError || !company) {
    return NextResponse.json({ error: "Firma sa nenasla" }, { status: 404 })
  }

  // Fetch chart of accounts for the company
  const { data: accounts, error: accountsError } = await (db.from("chart_of_accounts") as any)
    .select("id, synteticky_ucet, analyticky_ucet, nazov, typ")
    .eq("company_id", company_id)
    .is("deleted_at", null)

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 })
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({
      data: {
        accounting_profit: 0,
        total_revenues: 0,
        total_expenses: 0,
        non_deductible_expenses: 0,
        excess_depreciation: 0,
        unpaid_liabilities: 0,
        tax_exempt_income: 0,
        tax_base: 0,
        tax_loss_deduction: 0,
        adjusted_tax_base: 0,
        tax_rate: 21,
        tax_amount: 0,
        prepayments_paid: 0,
        tax_to_pay: 0,
      },
    })
  }

  // Separate class 5 (expenses) and class 6 (revenues) accounts
  const expenseAccountIds = accounts
    .filter((a: any) => a.synteticky_ucet.startsWith("5"))
    .map((a: any) => a.id)

  const revenueAccountIds = accounts
    .filter((a: any) => a.synteticky_ucet.startsWith("6"))
    .map((a: any) => a.id)

  const allAccountIds = [...expenseAccountIds, ...revenueAccountIds]

  if (allAccountIds.length === 0) {
    return NextResponse.json({
      data: {
        accounting_profit: 0,
        total_revenues: 0,
        total_expenses: 0,
        non_deductible_expenses: 0,
        excess_depreciation: 0,
        unpaid_liabilities: 0,
        tax_exempt_income: 0,
        tax_base: 0,
        tax_loss_deduction: 0,
        adjusted_tax_base: 0,
        tax_rate: 21,
        tax_amount: 0,
        prepayments_paid: 0,
        tax_to_pay: 0,
      },
    })
  }

  // Fetch journal entry lines for the year (posted entries only)
  const { data: journalLines, error: linesError } = await (db.from("journal_entry_lines") as any)
    .select(`
      account_id,
      debit_amount,
      credit_amount,
      journal_entry:journal_entries!inner(id, company_id, status, date)
    `)
    .eq("journal_entry.company_id", company_id)
    .eq("journal_entry.status", "posted")
    .gte("journal_entry.date", dateFrom)
    .lte("journal_entry.date", dateTo)
    .in("account_id", allAccountIds)

  if (linesError) {
    return NextResponse.json({ error: linesError.message }, { status: 500 })
  }

  // Build account ID to SU mapping
  const accountIdToSu: Record<string, string> = {}
  for (const acc of accounts) {
    accountIdToSu[acc.id] = acc.synteticky_ucet
  }

  // Aggregate by account
  const accountSums: Record<string, { account_number: string; total_debit: number; total_credit: number }> = {}

  for (const line of (journalLines || [])) {
    const accountId = line.account_id
    const su = accountIdToSu[accountId] || ""

    if (!accountSums[accountId]) {
      accountSums[accountId] = {
        account_number: su,
        total_debit: 0,
        total_credit: 0,
      }
    }

    accountSums[accountId].total_debit += Number(line.debit_amount) || 0
    accountSums[accountId].total_credit += Number(line.credit_amount) || 0
  }

  const allSums = Object.values(accountSums)
  const expenseSums = allSums.filter((s) => s.account_number.startsWith("5"))
  const revenueSums = allSums.filter((s) => s.account_number.startsWith("6"))

  // Parse adjustments
  const adj = {
    non_deductible_expenses: Number(adjustments?.non_deductible) || 0,
    excess_depreciation: Number(adjustments?.excess_depreciation) || 0,
    unpaid_liabilities: Number(adjustments?.unpaid_liabilities) || 0,
    tax_exempt_income: Number(adjustments?.tax_exempt) || 0,
    tax_loss_deduction: Number(adjustments?.loss_deduction) || 0,
    prepayments_paid: Number(adjustments?.prepayments) || 0,
  }

  const companyInfo = {
    business_type: company.business_type,
    size_category: company.size_category,
    is_vat_payer: company.is_vat_payer,
  }

  // Calculate DPPO
  const dppoData = calculateDPPO(revenueSums, expenseSums, adj, companyInfo)

  return NextResponse.json({
    data: dppoData,
    detail: {
      expense_accounts: expenseSums.length,
      revenue_accounts: revenueSums.length,
      journal_lines_count: (journalLines || []).length,
    },
  })
}

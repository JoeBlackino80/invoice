import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generatePayrollAccountingEntries } from "@/lib/payroll/payroll-calculator"
import type { PayrollResult } from "@/lib/payroll/payroll-calculator"

// POST /api/payroll/:id/approve - schvalenie vyplatnej listiny
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

  // Fetch payroll run
  const { data: payrollRun, error: runError } = await (db.from("payroll_runs") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (runError) {
    return NextResponse.json({ error: "Vyplatna listina nenajdena" }, { status: 404 })
  }

  if (payrollRun.status !== "draft") {
    return NextResponse.json(
      { error: "Schvalit je mozne iba vyplatnu listinu v stave 'draft'" },
      { status: 400 }
    )
  }

  // Fetch all payroll items
  const { data: items, error: itemsError } = await (db.from("payroll_items") as any)
    .select("*")
    .eq("payroll_run_id", params.id)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  if (!items || items.length === 0) {
    return NextResponse.json(
      { error: "Vyplatna listina neobsahuje ziadne polozky" },
      { status: 400 }
    )
  }

  // Validate all items have required data
  for (const item of items) {
    if (item.gross_salary == null || item.net_salary == null) {
      return NextResponse.json(
        { error: `Chybajuce udaje pre zamestnanca: ${item.employee_name}` },
        { status: 400 }
      )
    }
  }

  // Reconstruct PayrollResult objects from stored items
  const payrollResults: PayrollResult[] = items.map((item: any) => ({
    employee_id: item.employee_id,
    employee_name: item.employee_name,
    contract_type: item.contract_type || "hpp",
    period_month: payrollRun.period_month,
    period_year: payrollRun.period_year,
    gross_salary: item.gross_salary,
    surcharges: item.surcharges || { night: 0, saturday: 0, sunday: 0, holiday: 0, overtime: 0, total: 0 },
    sick_leave: item.sick_leave || { days_25_percent: 0, days_55_percent: 0, amount_25: 0, amount_55: 0, total: 0 },
    total_gross: item.total_gross,
    employee_insurance: item.employee_insurance || { health: 0, sickness: 0, retirement: 0, disability: 0, unemployment: 0, total: 0 },
    employer_insurance: item.employer_insurance || { health: 0, sickness: 0, retirement: 0, disability: 0, unemployment: 0, guarantee: 0, reserve: 0, accident: 0, total: 0 },
    tax: item.tax || { partial_tax_base: 0, nontaxable_amount: 0, tax_base: 0, tax_19_base: 0, tax_25_base: 0, tax_19: 0, tax_25: 0, tax_total: 0, tax_bonus_children: 0, tax_after_bonus: 0, is_withholding: false },
    net_salary: item.net_salary,
  }))

  // Generate accounting journal entries
  const accountingEntries = generatePayrollAccountingEntries(payrollResults)

  // Determine last day of the period for the journal entry date
  const entryDate = new Date(payrollRun.period_year, payrollRun.period_month, 0)
    .toISOString()
    .split("T")[0]

  // Create journal entry header
  const { data: journalEntry, error: journalError } = await (db.from("journal_entries") as any)
    .insert({
      company_id: payrollRun.company_id,
      entry_date: entryDate,
      description: `Mzdy za ${String(payrollRun.period_month).padStart(2, "0")}/${payrollRun.period_year}`,
      source: "payroll",
      source_id: payrollRun.id,
      status: "posted",
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (journalError) {
    return NextResponse.json({ error: journalError.message }, { status: 500 })
  }

  // Flatten all employee entries into journal lines
  let lineNumber = 0
  const journalLines: any[] = []
  for (const empEntries of accountingEntries) {
    for (const entry of empEntries.entries) {
      lineNumber++
      journalLines.push({
        journal_entry_id: journalEntry.id,
        company_id: payrollRun.company_id,
        line_number: lineNumber,
        account_debit: entry.debit_account,
        account_credit: entry.credit_account,
        amount: entry.amount,
        description: entry.description,
      })
    }
  }

  const { error: linesError } = await (db.from("journal_entry_lines") as any)
    .insert(journalLines)

  if (linesError) {
    // Rollback journal entry
    await (db.from("journal_entries") as any).delete().eq("id", journalEntry.id)
    return NextResponse.json({ error: linesError.message }, { status: 500 })
  }

  // Update payroll run status to approved
  const { data: updated, error: updateError } = await (db.from("payroll_runs") as any)
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      journal_entry_id: journalEntry.id,
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    ...updated,
    journal_entry: journalEntry,
    accounting_entries: accountingEntries,
  })
}

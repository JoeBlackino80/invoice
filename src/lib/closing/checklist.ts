import type { SupabaseClient } from "@supabase/supabase-js"

export type ChecklistStatus = "pending" | "done" | "skipped" | "na"

export interface ChecklistItem {
  id: string
  name: string
  description: string
  status: ChecklistStatus
  required: boolean
  autoVerifiable: boolean
  note?: string
}

const CHECKLIST_ITEMS: Omit<ChecklistItem, "status" | "note">[] = [
  {
    id: "invoices_posted",
    name: "Vsetky faktury zauctovane",
    description: "Skontrolujte, ci su vsetky vydane a prijate faktury zauctovane v hlavnom denniku.",
    required: true,
    autoVerifiable: true,
  },
  {
    id: "bank_statements_matched",
    name: "Bankove vypisy importovane a sparovane",
    description: "Overte, ci su vsetky bankove vypisy importovane a transakcie sparovane s fakturami.",
    required: true,
    autoVerifiable: true,
  },
  {
    id: "cash_documents_posted",
    name: "Pokladnicne doklady zauctovane",
    description: "Skontrolujte, ci su vsetky prijmove a vydavkove pokladnicne doklady zauctovane.",
    required: true,
    autoVerifiable: true,
  },
  {
    id: "internal_documents_posted",
    name: "Interne doklady zauctovane",
    description: "Overte, ci su vsetky interne doklady (prevodky, protokoly, atd.) zauctovane.",
    required: true,
    autoVerifiable: true,
  },
  {
    id: "vat_return_filed",
    name: "DPH priznanie podane",
    description: "Skontrolujte, ci je podane DPH priznanie za vsetky zdanovacie obdobia v roku.",
    required: true,
    autoVerifiable: true,
  },
  {
    id: "control_report_filed",
    name: "Kontrolny vykaz podany",
    description: "Overte, ci je kontrolny vykaz DPH podany za vsetky zdanovacie obdobia v roku.",
    required: true,
    autoVerifiable: true,
  },
  {
    id: "summary_declaration_filed",
    name: "Suhrnny vykaz podany",
    description: "Skontrolujte, ci je suhrnny vykaz podany (ak je to relevantne pre dodavky do EU).",
    required: false,
    autoVerifiable: true,
  },
  {
    id: "depreciation_calculated",
    name: "Odpisy majetku vypocitane",
    description: "Overte, ci su vypocitane a zauctovane odpisy dlhodobeho majetku za cely rok.",
    required: true,
    autoVerifiable: true,
  },
  {
    id: "exchange_rate_differences",
    name: "Kurzove rozdiely zauctovane",
    description: "Zauctujte kurzove rozdiely z prepoctu pohladavok a zavazkov v cudzej mene kurzom k 31.12.",
    required: true,
    autoVerifiable: false,
  },
  {
    id: "accruals_posted",
    name: "Casove rozlisenie",
    description: "Zauctujte naklady buduchich obdobi, vynosy buduchich obdobi a ostatne casove rozlisenie.",
    required: true,
    autoVerifiable: false,
  },
  {
    id: "provisions_posted",
    name: "Opravne polozky",
    description: "Vytvorte a zauctujte opravne polozky k pohladavkam, zasobam a majetku podla zakona.",
    required: true,
    autoVerifiable: false,
  },
  {
    id: "reserves_posted",
    name: "Rezervy",
    description: "Zauctujte zakonnu a ostatne rezervy (napr. na nevycerpanu dovolenku, audit, atd.).",
    required: true,
    autoVerifiable: false,
  },
  {
    id: "inventory_done",
    name: "Inventarizacia vykonana",
    description: "Vykonajte fyzicku inventarizaciu majetku, zasob a porovnajte s uctovnym stavom.",
    required: true,
    autoVerifiable: false,
  },
  {
    id: "trial_balance_checked",
    name: "Obratova predvaha skontrolovana",
    description: "Skontrolujte obratovu predvahu - sumy MD a D musia byt vyrovnane.",
    required: true,
    autoVerifiable: true,
  },
  {
    id: "income_tax_calculated",
    name: "Dan z prijmov vypocitana",
    description: "Vypocitajte a zauctujte dan z prijmov pravnickych alebo fyzickych osob.",
    required: true,
    autoVerifiable: true,
  },
]

async function verifyInvoicesPosted(companyId: string, fiscalYearStart: string, fiscalYearEnd: string, supabase: SupabaseClient): Promise<boolean> {
  // Check if there are any draft journal entries from invoices
  const { data, error } = await (supabase.from("journal_entries") as any)
    .select("id", { count: "exact" })
    .eq("company_id", companyId)
    .eq("status", "draft")
    .in("document_type", ["FA", "PFA"])
    .gte("date", fiscalYearStart)
    .lte("date", fiscalYearEnd)
    .is("deleted_at", null)

  if (error) return false
  return !data || data.length === 0
}

async function verifyBankStatementsMatched(companyId: string, fiscalYearStart: string, fiscalYearEnd: string, supabase: SupabaseClient): Promise<boolean> {
  // Check if there are unmatched bank transactions
  const { data, error } = await (supabase.from("bank_transactions") as any)
    .select("id", { count: "exact" })
    .eq("company_id", companyId)
    .is("paired_invoice_id", null)
    .is("journal_entry_id", null)
    .gte("date", fiscalYearStart)
    .lte("date", fiscalYearEnd)
    .is("deleted_at", null)

  if (error) return false
  return !data || data.length === 0
}

async function verifyCashDocumentsPosted(companyId: string, fiscalYearStart: string, fiscalYearEnd: string, supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await (supabase.from("journal_entries") as any)
    .select("id", { count: "exact" })
    .eq("company_id", companyId)
    .eq("status", "draft")
    .in("document_type", ["PPD", "VPD"])
    .gte("date", fiscalYearStart)
    .lte("date", fiscalYearEnd)
    .is("deleted_at", null)

  if (error) return false
  return !data || data.length === 0
}

async function verifyInternalDocumentsPosted(companyId: string, fiscalYearStart: string, fiscalYearEnd: string, supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await (supabase.from("journal_entries") as any)
    .select("id", { count: "exact" })
    .eq("company_id", companyId)
    .eq("status", "draft")
    .eq("document_type", "ID")
    .gte("date", fiscalYearStart)
    .lte("date", fiscalYearEnd)
    .is("deleted_at", null)

  if (error) return false
  return !data || data.length === 0
}

async function verifyVatReturnFiled(companyId: string, fiscalYearStart: string, fiscalYearEnd: string, supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await (supabase.from("tax_returns") as any)
    .select("id")
    .eq("company_id", companyId)
    .eq("type", "dph")
    .eq("status", "submitted")
    .gte("period_from", fiscalYearStart)
    .lte("period_to", fiscalYearEnd)
    .is("deleted_at", null)

  if (error) return false
  // At least some VAT returns should be filed
  return data && data.length > 0
}

async function verifyControlReportFiled(companyId: string, fiscalYearStart: string, fiscalYearEnd: string, supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await (supabase.from("tax_returns") as any)
    .select("id")
    .eq("company_id", companyId)
    .eq("type", "kv_dph")
    .eq("status", "submitted")
    .gte("period_from", fiscalYearStart)
    .lte("period_to", fiscalYearEnd)
    .is("deleted_at", null)

  if (error) return false
  return data && data.length > 0
}

async function verifySummaryDeclarationFiled(companyId: string, fiscalYearStart: string, fiscalYearEnd: string, supabase: SupabaseClient): Promise<boolean> {
  // Summary declaration may not be required - check if there are any EU transactions
  const { data, error } = await (supabase.from("tax_returns") as any)
    .select("id")
    .eq("company_id", companyId)
    .eq("type", "sv")
    .gte("period_from", fiscalYearStart)
    .lte("period_to", fiscalYearEnd)
    .is("deleted_at", null)

  if (error) return false
  // If no summary declarations exist at all, it may not be applicable
  if (!data || data.length === 0) return true
  // If they exist, check at least one is submitted
  return data.some((d: any) => d.status === "submitted")
}

async function verifyDepreciationCalculated(companyId: string, fiscalYearStart: string, _fiscalYearEnd: string, supabase: SupabaseClient): Promise<boolean> {
  const year = new Date(fiscalYearStart).getFullYear()
  const { data, error } = await (supabase.from("asset_depreciations") as any)
    .select("id")
    .eq("company_id", companyId)
    .eq("year", year)
    .is("deleted_at", null)

  if (error) return false
  return data && data.length > 0
}

async function verifyTrialBalanceChecked(companyId: string, fiscalYearStart: string, fiscalYearEnd: string, supabase: SupabaseClient): Promise<boolean> {
  // Check if the trial balance is balanced for the fiscal year
  const { data: accounts } = await (supabase.from("chart_of_accounts") as any)
    .select("id")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (!accounts || accounts.length === 0) return true

  const accountIds = accounts.map((a: any) => a.id)

  const { data: lines } = await (supabase.from("journal_entry_lines") as any)
    .select(`
      account_id,
      side,
      amount,
      journal_entry:journal_entries!inner(id, company_id, status, date)
    `)
    .eq("journal_entry.company_id", companyId)
    .eq("journal_entry.status", "posted")
    .gte("journal_entry.date", fiscalYearStart)
    .lte("journal_entry.date", fiscalYearEnd)
    .in("account_id", accountIds)

  if (!lines) return true

  let totalMD = 0
  let totalD = 0
  for (const line of lines) {
    const amount = Number(line.amount) || 0
    if (line.side === "MD") totalMD += amount
    else totalD += amount
  }

  return Math.abs(totalMD - totalD) < 0.01
}

async function verifyIncomeTaxCalculated(companyId: string, fiscalYearStart: string, fiscalYearEnd: string, supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await (supabase.from("tax_returns") as any)
    .select("id")
    .eq("company_id", companyId)
    .in("type", ["dppo", "dpfo"])
    .gte("period_from", fiscalYearStart)
    .lte("period_to", fiscalYearEnd)
    .is("deleted_at", null)

  if (error) return false
  return data && data.length > 0
}

type VerificationFn = (companyId: string, fiscalYearStart: string, fiscalYearEnd: string, supabase: SupabaseClient) => Promise<boolean>

const verificationFns: Record<string, VerificationFn> = {
  invoices_posted: verifyInvoicesPosted,
  bank_statements_matched: verifyBankStatementsMatched,
  cash_documents_posted: verifyCashDocumentsPosted,
  internal_documents_posted: verifyInternalDocumentsPosted,
  vat_return_filed: verifyVatReturnFiled,
  control_report_filed: verifyControlReportFiled,
  summary_declaration_filed: verifySummaryDeclarationFiled,
  depreciation_calculated: verifyDepreciationCalculated,
  trial_balance_checked: verifyTrialBalanceChecked,
  income_tax_calculated: verifyIncomeTaxCalculated,
}

export async function getClosingChecklist(
  companyId: string,
  fiscalYearId: string,
  supabase: SupabaseClient
): Promise<ChecklistItem[]> {
  // Load saved statuses from closing_checklist table
  const { data: savedItems } = await (supabase.from("closing_checklist") as any)
    .select("item_id, status, note")
    .eq("company_id", companyId)
    .eq("fiscal_year_id", fiscalYearId)
    .is("deleted_at", null)

  const savedMap: Record<string, { status: ChecklistStatus; note?: string }> = {}
  if (savedItems) {
    for (const item of savedItems) {
      savedMap[item.item_id] = { status: item.status, note: item.note }
    }
  }

  // Build checklist with saved statuses
  const checklist: ChecklistItem[] = CHECKLIST_ITEMS.map((item) => {
    const saved = savedMap[item.id]
    return {
      ...item,
      status: saved?.status || "pending",
      note: saved?.note,
    }
  })

  return checklist
}

export async function autoVerifyChecklist(
  companyId: string,
  fiscalYearId: string,
  fiscalYearStart: string,
  fiscalYearEnd: string,
  supabase: SupabaseClient
): Promise<ChecklistItem[]> {
  const checklist = await getClosingChecklist(companyId, fiscalYearId, supabase)

  const verifiedChecklist: ChecklistItem[] = []

  for (const item of checklist) {
    // Only auto-verify items that are auto-verifiable and currently pending
    if (item.autoVerifiable && item.status === "pending") {
      const verifyFn = verificationFns[item.id]
      if (verifyFn) {
        try {
          const passed = await verifyFn(companyId, fiscalYearStart, fiscalYearEnd, supabase)
          verifiedChecklist.push({
            ...item,
            status: passed ? "done" : "pending",
          })
        } catch {
          verifiedChecklist.push(item)
        }
      } else {
        verifiedChecklist.push(item)
      }
    } else {
      verifiedChecklist.push(item)
    }
  }

  return verifiedChecklist
}

export function getChecklistProgress(checklist: ChecklistItem[]): {
  total: number
  done: number
  skipped: number
  na: number
  pending: number
  percentage: number
  isComplete: boolean
} {
  const total = checklist.length
  const done = checklist.filter((i) => i.status === "done").length
  const skipped = checklist.filter((i) => i.status === "skipped").length
  const na = checklist.filter((i) => i.status === "na").length
  const pending = checklist.filter((i) => i.status === "pending").length
  const relevantTotal = total - na
  const completedCount = done + skipped
  const percentage = relevantTotal > 0 ? Math.round((completedCount / relevantTotal) * 100) : 100

  // Complete when all required items are done and no pending required items remain
  const requiredPending = checklist.filter((i) => i.required && i.status === "pending").length
  const isComplete = requiredPending === 0

  return { total, done, skipped, na, pending, percentage, isComplete }
}

export { CHECKLIST_ITEMS }

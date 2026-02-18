// Krížová kontrola DPH: faktúry vs účet 343, DPH vs KV DPH
import type { SupabaseClient } from "@supabase/supabase-js"

export interface DPHCrosscheckResult {
  invoiceOutputVAT: number
  invoiceInputVAT: number
  invoiceNetVAT: number
  account343Balance: number
  difference: number
  isMatched: boolean
  details: string
}

export interface DPHvsKVResult {
  dphOutputTotal: number
  kvOutputTotal: number
  dphInputTotal: number
  kvInputTotal: number
  outputMatched: boolean
  inputMatched: boolean
  details: string
}

/**
 * Porovná DPH z faktúr s zostatkom účtu 343 z účtovníctva
 */
export async function crosscheckDPHvsAccount343(
  companyId: string,
  supabase: SupabaseClient,
  periodFrom: string,
  periodTo: string
): Promise<DPHCrosscheckResult> {
  // 1. Suma DPH z faktúr
  const { data: invoices } = await (supabase.from("invoices") as any)
    .select("type, vat_amount, total")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .neq("status", "stornovana")
    .gte("issue_date", periodFrom)
    .lte("issue_date", periodTo)

  let outputVAT = 0
  let inputVAT = 0
  if (invoices) {
    for (const inv of invoices) {
      const vat = Number(inv.vat_amount) || 0
      if (inv.type === "vydana" || inv.type === "proforma") {
        outputVAT += vat
      } else if (inv.type === "prijata") {
        inputVAT += vat
      } else if (inv.type === "dobropis") {
        // Dobropis znižuje pôvodnú stranu
        outputVAT -= Math.abs(vat)
      }
    }
  }

  const netVAT = Math.round((outputVAT - inputVAT) * 100) / 100

  // 2. Zostatok účtu 343 z journal_entry_lines
  const { data: account343 } = await (supabase.from("chart_of_accounts") as any)
    .select("id")
    .eq("company_id", companyId)
    .eq("synth_account", "343")
    .is("deleted_at", null)
    .limit(1)
    .single()

  let account343Balance = 0
  if (account343) {
    const { data: lines } = await (supabase.from("journal_entry_lines") as any)
      .select("side, amount, journal_entries!inner(entry_date, status, company_id)")
      .eq("account_id", account343.id)
      .eq("journal_entries.company_id", companyId)
      .eq("journal_entries.status", "zauctovany")
      .gte("journal_entries.entry_date", periodFrom)
      .lte("journal_entries.entry_date", periodTo)

    if (lines) {
      for (const line of lines) {
        const amt = Number(line.amount) || 0
        if (line.side === "D") {
          account343Balance += amt // Strana Dal = záväzok DPH
        } else {
          account343Balance -= amt // Strana MD = nárok DPH
        }
      }
    }
  }

  account343Balance = Math.round(account343Balance * 100) / 100
  const difference = Math.round((netVAT - account343Balance) * 100) / 100
  const isMatched = Math.abs(difference) < 0.02

  let details = ""
  if (isMatched) {
    details = "DPH z faktúr sa zhoduje so zostatkom účtu 343."
  } else if (difference > 0) {
    details = `DPH z faktúr je o ${Math.abs(difference).toFixed(2)} € vyššia ako zostatok účtu 343. Skontrolujte zaúčtovanie faktúr.`
  } else {
    details = `Zostatok účtu 343 je o ${Math.abs(difference).toFixed(2)} € vyšší ako DPH z faktúr. Skontrolujte ručné zápisy na účte 343.`
  }

  return {
    invoiceOutputVAT: Math.round(outputVAT * 100) / 100,
    invoiceInputVAT: Math.round(inputVAT * 100) / 100,
    invoiceNetVAT: netVAT,
    account343Balance,
    difference,
    isMatched,
    details,
  }
}

/**
 * Porovná DPH priznanie s kontrolným výkazom
 */
export function crosscheckDPHvsKV(
  dphData: any,
  kvData: any
): DPHvsKVResult {
  // DPH výstup = r28 (celková daň na výstupe)
  const dphOutputTotal = Number(dphData?.r28 || dphData?.output_vat_total || 0)
  // DPH vstup = r27 (celková daň na vstupe)
  const dphInputTotal = Number(dphData?.r27 || dphData?.input_vat_total || 0)

  // KV - výstupová DPH = súčet sekcií A.1 + A.2
  let kvOutputTotal = 0
  const outputSections = ["A1", "A2", "a1", "a2"]
  for (const key of outputSections) {
    const section = kvData?.[key] || kvData?.[key.toLowerCase()]
    if (Array.isArray(section)) {
      for (const item of section) {
        kvOutputTotal += Number(item.vat_amount || item.suma_dane || 0)
      }
    }
  }

  // KV - vstupová DPH = súčet sekcií B.1 + B.2 + B.3
  let kvInputTotal = 0
  const inputSections = ["B1", "B2", "B3", "b1", "b2", "b3"]
  for (const key of inputSections) {
    const section = kvData?.[key] || kvData?.[key.toLowerCase()]
    if (Array.isArray(section)) {
      for (const item of section) {
        kvInputTotal += Number(item.vat_amount || item.suma_dane || 0)
      }
    }
  }

  kvOutputTotal = Math.round(kvOutputTotal * 100) / 100
  kvInputTotal = Math.round(kvInputTotal * 100) / 100

  const outputMatched = Math.abs(dphOutputTotal - kvOutputTotal) < 0.02
  const inputMatched = Math.abs(dphInputTotal - kvInputTotal) < 0.02

  let details = ""
  if (outputMatched && inputMatched) {
    details = "DPH priznanie sa zhoduje s kontrolným výkazom."
  } else {
    const parts: string[] = []
    if (!outputMatched) {
      parts.push(`Výstup DPH: priznanie ${dphOutputTotal.toFixed(2)} € vs KV ${kvOutputTotal.toFixed(2)} € (rozdiel ${Math.abs(dphOutputTotal - kvOutputTotal).toFixed(2)} €)`)
    }
    if (!inputMatched) {
      parts.push(`Vstup DPH: priznanie ${dphInputTotal.toFixed(2)} € vs KV ${kvInputTotal.toFixed(2)} € (rozdiel ${Math.abs(dphInputTotal - kvInputTotal).toFixed(2)} €)`)
    }
    details = parts.join(". ")
  }

  return {
    dphOutputTotal,
    kvOutputTotal,
    dphInputTotal,
    kvInputTotal,
    outputMatched,
    inputMatched,
    details,
  }
}

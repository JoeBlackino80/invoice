/**
 * Income Tax XML Generators for Slovak Republic
 * DPPO - Dan z prijmov pravnickych osob (Corporate Income Tax)
 * DPFO - Dan z prijmov fyzickych osob (Personal Income Tax) typ B
 * Generates XML per FS SR XSD schemas for 2025.
 */

import type { DPPOData, DPFOData } from "./income-tax-calculator"

interface CompanyForTax {
  name: string
  ico: string | null
  dic: string | null
  ic_dph: string | null
  street: string | null
  city: string | null
  zip: string | null
  country: string
  business_type: string
}

type RecognitionType = "riadne" | "opravne" | "dodatocne"

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function fmt(amount: number): string {
  return amount.toFixed(2)
}

function recognitionTypeCode(type: RecognitionType): string {
  switch (type) {
    case "riadne": return "R"
    case "opravne": return "O"
    case "dodatocne": return "D"
    default: return "R"
  }
}

function legalFormCode(businessType: string): string {
  switch (businessType) {
    case "sro": return "112"
    case "as": return "121"
    case "druzstvo": return "205"
    case "szco": return "101"
    default: return "999"
  }
}

/**
 * Generate DPPO XML for FS SR (Corporate Income Tax).
 */
export function generateDPPOXml(
  company: CompanyForTax,
  dppoData: DPPOData,
  year: number,
  recognitionType: RecognitionType
): string {
  const dicClean = (company.dic || "").replace(/\s/g, "")
  const icoClean = (company.ico || "").replace(/\s/g, "")

  const L: string[] = []

  L.push('<?xml version="1.0" encoding="UTF-8"?>')
  L.push('<dokument xmlns="http://www.financnasprava.sk/dppo/2025">')
  L.push('  <hlavicka>')
  L.push(`    <dic>${escapeXml(dicClean)}</dic>`)
  L.push(`    <ico>${escapeXml(icoClean)}</ico>`)
  L.push(`    <pravnaForma>${legalFormCode(company.business_type)}</pravnaForma>`)
  L.push(`    <nazovDanSubjektu>${escapeXml(company.name)}</nazovDanSubjektu>`)
  L.push(`    <ulica>${escapeXml(company.street || "")}</ulica>`)
  L.push(`    <mesto>${escapeXml(company.city || "")}</mesto>`)
  L.push(`    <psc>${escapeXml(company.zip || "")}</psc>`)
  L.push('    <stat>SK</stat>')
  L.push(`    <zdanovaciObdobieOd>01.01.${year}</zdanovaciObdobieOd>`)
  L.push(`    <zdanovaciObdobieDo>31.12.${year}</zdanovaciObdobieDo>`)
  L.push(`    <druhPriznania>${recognitionTypeCode(recognitionType)}</druhPriznania>`)
  L.push(`    <datumPodania>${new Date().toISOString().split("T")[0]}</datumPodania>`)
  L.push('  </hlavicka>')

  L.push('  <telo>')

  // Cast I - Vysledok hospodarenia
  L.push('    <castI>')
  L.push(`      <r100>${fmt(dppoData.total_revenues)}</r100>`)
  L.push(`      <r110>${fmt(dppoData.total_expenses)}</r110>`)
  L.push(`      <r200>${fmt(dppoData.accounting_profit)}</r200>`)
  L.push('    </castI>')

  // Cast II - Pripocitatelne polozky
  L.push('    <castII>')
  L.push(`      <r210>${fmt(dppoData.non_deductible_expenses)}</r210>`)
  L.push(`      <r220>${fmt(dppoData.excess_depreciation)}</r220>`)
  L.push(`      <r230>${fmt(dppoData.unpaid_liabilities)}</r230>`)
  L.push('    </castII>')

  // Cast III - Odpocitatelne polozky
  L.push('    <castIII>')
  L.push(`      <r310>${fmt(dppoData.tax_exempt_income)}</r310>`)
  L.push('    </castIII>')

  // Cast IV - Zaklad dane
  L.push('    <castIV>')
  L.push(`      <r400>${fmt(dppoData.tax_base)}</r400>`)
  L.push(`      <r410>${fmt(dppoData.tax_loss_deduction)}</r410>`)
  L.push(`      <r420>${fmt(dppoData.adjusted_tax_base)}</r420>`)
  L.push('    </castIV>')

  // Cast V - Vypocet dane
  L.push('    <castV>')
  L.push(`      <r500>${dppoData.tax_rate}</r500>`)
  L.push(`      <r510>${fmt(dppoData.tax_amount)}</r510>`)
  L.push(`      <r520>${fmt(dppoData.prepayments_paid)}</r520>`)
  L.push(`      <r530>${fmt(dppoData.tax_to_pay)}</r530>`)
  L.push('    </castV>')

  L.push('  </telo>')
  L.push('</dokument>')

  return L.join("\n")
}

/**
 * Generate DPFO typ B XML for FS SR (Personal Income Tax).
 */
export function generateDPFOXml(
  company: CompanyForTax,
  dpfoData: DPFOData,
  year: number,
  recognitionType: RecognitionType
): string {
  const dicClean = (company.dic || "").replace(/\s/g, "")

  const L: string[] = []

  L.push('<?xml version="1.0" encoding="UTF-8"?>')
  L.push('<dokument xmlns="http://www.financnasprava.sk/dpfo-b/2025">')
  L.push('  <hlavicka>')
  L.push(`    <dic>${escapeXml(dicClean)}</dic>`)
  L.push(`    <nazovDanSubjektu>${escapeXml(company.name)}</nazovDanSubjektu>`)
  L.push(`    <ulica>${escapeXml(company.street || "")}</ulica>`)
  L.push(`    <mesto>${escapeXml(company.city || "")}</mesto>`)
  L.push(`    <psc>${escapeXml(company.zip || "")}</psc>`)
  L.push('    <stat>SK</stat>')
  L.push(`    <zdanovaciObdobie>${year}</zdanovaciObdobie>`)
  L.push(`    <druhPriznania>${recognitionTypeCode(recognitionType)}</druhPriznania>`)
  L.push(`    <datumPodania>${new Date().toISOString().split("T")[0]}</datumPodania>`)
  L.push('  </hlavicka>')

  L.push('  <telo>')

  // Cast VI - Prijmy z podnikania (par.6)
  L.push('    <castVI>')
  L.push(`      <r600>${fmt(dpfoData.business_income)}</r600>`)
  L.push(`      <r601>${dpfoData.expense_type === "flat_rate" ? "P" : "S"}</r601>`)
  L.push(`      <r610>${fmt(dpfoData.expenses_used)}</r610>`)
  if (dpfoData.expense_type === "flat_rate") {
    L.push(`      <r611>${fmt(dpfoData.flat_rate_expenses)}</r611>`)
  } else {
    L.push(`      <r612>${fmt(dpfoData.actual_expenses)}</r612>`)
  }
  L.push(`      <r620>${fmt(dpfoData.partial_tax_base)}</r620>`)
  L.push('    </castVI>')

  // Cast VII - Nezdanitelne casti
  L.push('    <castVII>')
  L.push(`      <r700>${fmt(dpfoData.personal_allowance)}</r700>`)
  L.push(`      <r710>${fmt(dpfoData.spouse_allowance)}</r710>`)
  L.push(`      <r720>${fmt(dpfoData.pension_insurance)}</r720>`)
  L.push(`      <r730>${fmt(dpfoData.total_non_taxable)}</r730>`)
  L.push('    </castVII>')

  // Cast VIII - Zaklad dane a vypocet dane
  L.push('    <castVIII>')
  L.push(`      <r800>${fmt(dpfoData.tax_base)}</r800>`)
  L.push(`      <r810>${fmt(dpfoData.tax_rate_19)}</r810>`)
  L.push(`      <r820>${fmt(dpfoData.tax_rate_25)}</r820>`)
  L.push(`      <r830>${fmt(dpfoData.tax_amount)}</r830>`)
  L.push('    </castVIII>')

  // Cast IX - Danovy bonus a vysledna dan
  L.push('    <castIX>')
  L.push(`      <r900>${fmt(dpfoData.child_bonus)}</r900>`)
  L.push(`      <r910>${fmt(dpfoData.employee_bonus)}</r910>`)
  L.push(`      <r920>${fmt(dpfoData.final_tax)}</r920>`)
  L.push(`      <r930>${fmt(dpfoData.prepayments_paid)}</r930>`)
  L.push(`      <r940>${fmt(dpfoData.tax_to_pay)}</r940>`)
  L.push('    </castIX>')

  L.push('  </telo>')
  L.push('</dokument>')

  return L.join("\n")
}

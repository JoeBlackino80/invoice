// XML generatory pre danove hlasenia - Financna sprava SR
// Mesacny prehlad o zrazenych preddavkoch na dan
// Rocne hlasenie o vyuctovani dane
// Aktualizovane pre XSD schemy 2025

import type { MonthlyTaxReport, AnnualTaxReport } from "./tax-declarations"

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0")
}

function fmt(n: number): string {
  return n.toFixed(2)
}

/**
 * Generuje XML mesacneho prehladu pre Financnu spravu SR
 * Mesacny prehlad o zrazenych preddavkoch na dan (par.35 ods.6 ZDP)
 */
export function generateMonthlyTaxReportXML(report: MonthlyTaxReport): string {
  const periodStr = `${report.period.year}-${pad2(report.period.month)}`

  const L: string[] = []

  L.push('<?xml version="1.0" encoding="UTF-8"?>')
  L.push('<dokument xmlns="http://www.financnasprava.sk/dpmv/2025">')
  L.push('  <hlavicka>')
  L.push('    <typDokumentu>DPMVS</typDokumentu>')
  L.push('    <typHlasenia>mesacny_prehlad</typHlasenia>')
  L.push(`    <obdobie>${periodStr}</obdobie>`)
  L.push(`    <rok>${report.period.year}</rok>`)
  L.push(`    <mesiac>${pad2(report.period.month)}</mesiac>`)
  L.push(`    <datumVytvorenia>${report.generated_at}</datumVytvorenia>`)
  L.push(`    <datumPodania>${new Date().toISOString().split("T")[0]}</datumPodania>`)
  L.push('  </hlavicka>')
  L.push('  <zamestnavatel>')
  L.push(`    <nazov>${escapeXml(report.company.name)}</nazov>`)
  L.push(`    <ico>${escapeXml(report.company.ico)}</ico>`)
  L.push(`    <dic>${escapeXml(report.company.dic)}</dic>`)
  L.push(`    <adresa>${escapeXml(report.company.address)}</adresa>`)
  L.push(`    <danovyUrad>${escapeXml(report.company.tax_office)}</danovyUrad>`)
  L.push('  </zamestnavatel>')
  L.push('  <udaje>')
  L.push(`    <pocetZamestnancov>${report.number_of_employees}</pocetZamestnancov>`)
  L.push(`    <r01>${fmt(report.total_gross_income)}</r01>`)
  L.push(`    <r02>${fmt(report.total_insurance_deductions)}</r02>`)
  L.push(`    <r03>${fmt(report.total_nczd)}</r03>`)
  L.push(`    <r04>${fmt(report.total_tax_base)}</r04>`)
  L.push(`    <r05>${fmt(report.total_tax_19pct)}</r05>`)
  L.push(`    <r06>${fmt(report.total_tax_25pct)}</r06>`)
  L.push(`    <r07>${fmt(report.total_tax_bonus)}</r07>`)
  L.push(`    <r08>${fmt(report.total_tax_withheld)}</r08>`)
  L.push('  </udaje>')
  L.push('</dokument>')

  return L.join("\n")
}

/**
 * Generuje XML rocneho hlasenia pre Financnu spravu SR
 * Rocne hlasenie o vyuctovani dane (par.39 ods.9 ZDP)
 */
export function generateAnnualTaxReportXML(report: AnnualTaxReport): string {
  const L: string[] = []

  L.push('<?xml version="1.0" encoding="UTF-8"?>')
  L.push('<dokument xmlns="http://www.financnasprava.sk/dpmv/2025">')
  L.push('  <hlavicka>')
  L.push('    <typDokumentu>DPMVS</typDokumentu>')
  L.push('    <typHlasenia>rocne_hlasenie</typHlasenia>')
  L.push(`    <rok>${report.year}</rok>`)
  L.push(`    <datumVytvorenia>${report.generated_at}</datumVytvorenia>`)
  L.push(`    <datumPodania>${new Date().toISOString().split("T")[0]}</datumPodania>`)
  L.push('  </hlavicka>')
  L.push('  <zamestnavatel>')
  L.push(`    <nazov>${escapeXml(report.company.name)}</nazov>`)
  L.push(`    <ico>${escapeXml(report.company.ico)}</ico>`)
  L.push(`    <dic>${escapeXml(report.company.dic)}</dic>`)
  L.push(`    <adresa>${escapeXml(report.company.address)}</adresa>`)
  L.push(`    <danovyUrad>${escapeXml(report.company.tax_office)}</danovyUrad>`)
  L.push('  </zamestnavatel>')
  L.push('  <suhrn>')
  L.push(`    <pocetZamestnancov>${report.number_of_employees}</pocetZamestnancov>`)
  L.push(`    <uhrnPrijmov>${fmt(report.totals.total_gross_income)}</uhrnPrijmov>`)
  L.push(`    <poistneZamestnanec>${fmt(report.totals.total_insurance_deductions)}</poistneZamestnanec>`)
  L.push(`    <nezdanitelnaCast>${fmt(report.totals.total_nczd)}</nezdanitelnaCast>`)
  L.push(`    <zakladDane>${fmt(report.totals.total_tax_base)}</zakladDane>`)
  L.push(`    <dan19>${fmt(report.totals.total_tax_19pct)}</dan19>`)
  L.push(`    <dan25>${fmt(report.totals.total_tax_25pct)}</dan25>`)
  L.push(`    <danovyBonus>${fmt(report.totals.total_tax_bonus)}</danovyBonus>`)
  L.push(`    <preddavokDan>${fmt(report.totals.total_tax_withheld)}</preddavokDan>`)
  L.push('  </suhrn>')
  L.push('  <zamestnanci>')

  for (const emp of report.employees) {
    L.push('    <zamestnanec>')
    L.push(`      <rodneCislo>${escapeXml(emp.rodne_cislo)}</rodneCislo>`)
    L.push(`      <priezviskoMeno>${escapeXml(emp.name)}</priezviskoMeno>`)
    L.push(`      <pocetMesiacov>${emp.months_worked}</pocetMesiacov>`)
    L.push(`      <uhrnPrijmov>${fmt(emp.total_gross_income)}</uhrnPrijmov>`)
    L.push(`      <poistneZamestnanec>${fmt(emp.total_insurance_employee)}</poistneZamestnanec>`)
    L.push(`      <nezdanitelnaCast>${fmt(emp.total_nczd)}</nezdanitelnaCast>`)
    L.push(`      <zakladDane>${fmt(emp.total_tax_base)}</zakladDane>`)
    L.push(`      <dan19>${fmt(emp.total_tax_19pct)}</dan19>`)
    L.push(`      <dan25>${fmt(emp.total_tax_25pct)}</dan25>`)
    L.push(`      <danovyBonus>${fmt(emp.total_tax_bonus)}</danovyBonus>`)
    L.push(`      <preddavokDan>${fmt(emp.total_tax_withheld)}</preddavokDan>`)
    L.push('    </zamestnanec>')
  }

  L.push('  </zamestnanci>')
  L.push('</dokument>')

  return L.join("\n")
}

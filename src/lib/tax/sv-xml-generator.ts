/**
 * Suhrnny vykaz (SV) - EU Summary Declaration XML Generator
 * Generates XML per FS SR XSD schema (sv) for 2025.
 */

import type { SVData, SVRecord } from "./sv-calculator"

interface CompanyForSV {
  name: string
  ico: string | null
  dic: string | null
  ic_dph: string | null
  street: string | null
  city: string | null
  zip: string | null
  country: string
}

interface SVPeriod {
  period_from: string
  period_to: string
  month?: number
  quarter?: number
  year: number
}

type RecognitionType = "riadne" | "opravne" | "dodatocne"

function supplyTypeCode(type: SVRecord["supply_type"]): string {
  switch (type) {
    case "goods": return "0"
    case "triangular": return "1"
    case "services": return "2"
    default: return "0"
  }
}

function recognitionTypeCode(type: RecognitionType): string {
  switch (type) {
    case "riadne": return "R"
    case "opravne": return "O"
    case "dodatocne": return "D"
    default: return "R"
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function formatAmount(amount: number): string {
  return Math.round(amount).toString()
}

/**
 * Generate SV XML for submission to the Slovak Financial Administration.
 */
export function generateSVXml(
  company: CompanyForSV,
  svData: SVData,
  period: SVPeriod,
  recognitionType: RecognitionType
): string {
  const dicClean = (company.dic || "").replace(/\s/g, "")
  const icDphClean = (company.ic_dph || "").replace(/\s/g, "")

  let periodType = "M"
  let periodValue = ""

  if (period.quarter) {
    periodType = "Q"
    periodValue = period.quarter.toString()
  } else if (period.month) {
    periodType = "M"
    periodValue = period.month.toString().padStart(2, "0")
  }

  const L: string[] = []

  L.push('<?xml version="1.0" encoding="UTF-8"?>')
  L.push('<dokument xmlns="http://www.financnasprava.sk/sv/2025">')
  L.push('  <hlavicka>')
  L.push(`    <dic>${escapeXml(dicClean)}</dic>`)
  L.push(`    <icDph>${escapeXml(icDphClean)}</icDph>`)
  L.push(`    <nazovDanSubjektu>${escapeXml(company.name)}</nazovDanSubjektu>`)
  L.push(`    <ulica>${escapeXml(company.street || "")}</ulica>`)
  L.push(`    <mesto>${escapeXml(company.city || "")}</mesto>`)
  L.push(`    <psc>${escapeXml(company.zip || "")}</psc>`)
  L.push('    <stat>SK</stat>')
  L.push(`    <rok>${period.year}</rok>`)
  L.push(`    <obdobieTyp>${periodType}</obdobieTyp>`)
  L.push(`    <obdobie>${periodValue}</obdobie>`)
  L.push(`    <druhPriznania>${recognitionTypeCode(recognitionType)}</druhPriznania>`)
  L.push(`    <datumPodania>${new Date().toISOString().split("T")[0]}</datumPodania>`)
  L.push('  </hlavicka>')

  L.push('  <telo>')
  L.push('    <riadky>')

  svData.records.forEach((record, index) => {
    L.push('      <riadok>')
    L.push(`        <poradCislo>${index + 1}</poradCislo>`)
    L.push(`        <kodKrajiny>${escapeXml(record.country_code)}</kodKrajiny>`)
    L.push(`        <icDphOdberatela>${escapeXml(record.ic_dph_customer)}</icDphOdberatela>`)
    L.push(`        <hodnotaDodavok>${formatAmount(record.total_value)}</hodnotaDodavok>`)
    L.push(`        <kodPlnenia>${supplyTypeCode(record.supply_type)}</kodPlnenia>`)
    L.push('      </riadok>')
  })

  L.push('    </riadky>')
  L.push('    <sucty>')
  L.push(`      <tovarSpolu>${formatAmount(svData.total_goods)}</tovarSpolu>`)
  L.push(`      <sluzbySpolu>${formatAmount(svData.total_services)}</sluzbySpolu>`)
  L.push(`      <trojstrannyObchodSpolu>${formatAmount(svData.total_triangular)}</trojstrannyObchodSpolu>`)
  L.push(`      <celkovaSuma>${formatAmount(svData.grand_total)}</celkovaSuma>`)
  L.push('    </sucty>')
  L.push('  </telo>')
  L.push('</dokument>')

  return L.join("\n")
}

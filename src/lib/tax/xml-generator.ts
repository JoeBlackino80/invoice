/**
 * XML Generator for Slovak DPH (VAT) Return and KV DPH (Control Report)
 * 
 * Generates XML structures compatible with Slovak tax authority
 * (Financna sprava SR) XSD schemas for 2025.
 */

import type { DPHData } from "./dph-calculator"
import type { KVDPHData, KVDPHRecord } from "./kvdph-calculator"

export interface CompanyInfo {
  name: string
  ico: string
  dic: string
  ic_dph: string
  street?: string
  city?: string
  zip?: string
}

export type RecognitionType = "riadne" | "opravne" | "dodatocne"

export interface PeriodInfo {
  period_from: string // YYYY-MM-DD
  period_to: string // YYYY-MM-DD
  year: number
  month?: number
  quarter?: number
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function fmt(amount: number): string {
  return amount.toFixed(2)
}

function recognitionCode(type: RecognitionType): string {
  switch (type) {
    case "riadne": return "R"
    case "opravne": return "O"
    case "dodatocne": return "D"
    default: return "R"
  }
}

/**
 * Generate XML for DPH (VAT) return according to FS SR XSD schema (dphdp).
 * Contains rows r01-r37 per official form structure.
 */
export function generateDPHXml(
  company: CompanyInfo,
  dphData: DPHData,
  period: PeriodInfo,
  recognitionType: RecognitionType
): string {
  const L: string[] = []

  L.push('<?xml version="1.0" encoding="UTF-8"?>')
  L.push('<dokument xmlns="http://www.financnasprava.sk/dphdp/2025">')

  // Hlavicka
  L.push('  <hlavicka>')
  L.push(`    <dic>${escapeXml(company.dic)}</dic>`)
  L.push(`    <icDph>${escapeXml(company.ic_dph)}</icDph>`)
  L.push(`    <nazovDanSubjektu>${escapeXml(company.name)}</nazovDanSubjektu>`)
  L.push(`    <ulica>${escapeXml(company.street || "")}</ulica>`)
  L.push(`    <mesto>${escapeXml(company.city || "")}</mesto>`)
  L.push(`    <psc>${escapeXml(company.zip || "")}</psc>`)
  L.push('    <stat>SK</stat>')
  L.push(`    <rok>${period.year}</rok>`)
  if (period.month) {
    L.push(`    <mesiac>${String(period.month).padStart(2, "0")}</mesiac>`)
  }
  if (period.quarter) {
    L.push(`    <stvrrok>${period.quarter}</stvrrok>`)
  }
  L.push(`    <druhPriznania>${recognitionCode(recognitionType)}</druhPriznania>`)
  L.push(`    <datumPodania>${new Date().toISOString().split("T")[0]}</datumPodania>`)
  L.push('  </hlavicka>')

  // Telo - riadky 01-37
  L.push('  <telo>')

  // I. Dodanie tovarov a sluzieb
  L.push(`    <!-- I. Dodanie tovarov a sluzieb -->`)
  L.push(`    <r01>${fmt(dphData.r01)}</r01>`)
  L.push(`    <r02>${fmt(dphData.r02)}</r02>`)
  L.push(`    <r03>${fmt(dphData.r03)}</r03>`)
  L.push(`    <r04>${fmt(dphData.r04)}</r04>`)
  L.push(`    <r05>${fmt(dphData.r05)}</r05>`)
  L.push(`    <r06>${fmt(dphData.r06)}</r06>`)
  L.push(`    <r07>${fmt(dphData.r07)}</r07>`)

  // II. Nadobudnutie tovaru, prijatie sluzieb, tuzemsky prenos, dovoz
  L.push(`    <!-- II. Nadobudnutie tovaru z EU, sluzby, prenos, dovoz -->`)
  L.push(`    <r08>${fmt(dphData.r08)}</r08>`)
  L.push(`    <r09>${fmt(dphData.r09)}</r09>`)
  L.push(`    <r10>${fmt(dphData.r10)}</r10>`)
  L.push(`    <r11>${fmt(dphData.r11)}</r11>`)
  L.push(`    <r12>${fmt(dphData.r12)}</r12>`)
  L.push(`    <r13>${fmt(dphData.r13)}</r13>`)
  L.push(`    <r14>${fmt(dphData.r14)}</r14>`)
  L.push(`    <r15>${fmt(dphData.r15)}</r15>`)
  L.push(`    <r16>${fmt(dphData.r16)}</r16>`)
  L.push(`    <r17>${fmt(dphData.r17)}</r17>`)

  // III. Oprava zakladu dane
  L.push(`    <!-- III. Oprava zakladu dane -->`)
  L.push(`    <r18>${fmt(dphData.r18)}</r18>`)
  L.push(`    <r19>${fmt(dphData.r19)}</r19>`)
  L.push(`    <r20>${fmt(dphData.r20)}</r20>`)
  L.push(`    <r21>${fmt(dphData.r21)}</r21>`)

  // IV. Dan na vstupe
  L.push(`    <!-- IV. Dan na vstupe - narok na odpocet -->`)
  L.push(`    <r22>${fmt(dphData.r22)}</r22>`)
  L.push(`    <r23>${fmt(dphData.r23)}</r23>`)
  L.push(`    <r24>${fmt(dphData.r24)}</r24>`)
  L.push(`    <r25>${fmt(dphData.r25)}</r25>`)
  L.push(`    <r26>${fmt(dphData.r26)}</r26>`)
  L.push(`    <r27>${fmt(dphData.r27)}</r27>`)

  // V. Vysledok
  L.push(`    <!-- V. Vysledok -->`)
  L.push(`    <r28>${fmt(dphData.r28)}</r28>`)
  L.push(`    <r29>${fmt(dphData.r29)}</r29>`)
  L.push(`    <r30>${fmt(dphData.r30)}</r30>`)
  L.push(`    <r31>${fmt(dphData.r31)}</r31>`)

  // VI. Korekcie a doplnkove riadky
  L.push(`    <!-- VI. Korekcie -->`)
  L.push(`    <r32>${fmt(dphData.r32)}</r32>`)
  L.push(`    <r33>${fmt(dphData.r33)}</r33>`)
  L.push(`    <r34>${fmt(dphData.r34)}</r34>`)
  L.push(`    <r35>${fmt(dphData.r35)}</r35>`)
  L.push(`    <r36>${fmt(dphData.r36)}</r36>`)
  L.push(`    <r37>${fmt(dphData.r37)}</r37>`)

  L.push('  </telo>')

  // Statistiky
  L.push('  <statistiky>')
  L.push(`    <pocetVydanychFaktur>${dphData.issued_invoice_count}</pocetVydanychFaktur>`)
  L.push(`    <pocetPrijatychFaktur>${dphData.received_invoice_count}</pocetPrijatychFaktur>`)
  L.push('  </statistiky>')

  L.push('</dokument>')

  return L.join("\n")
}

/**
 * Generate XML for KV DPH (VAT Control Report) according to FS SR XSD schema (kvdph).
 * Sections: A.1, A.2, B.1, B.2, B.3, C.1, C.2, D.1, D.2
 */
export function generateKVDPHXml(
  company: CompanyInfo,
  kvdphData: KVDPHData,
  period: PeriodInfo,
  recognitionType: RecognitionType
): string {
  const L: string[] = []

  L.push('<?xml version="1.0" encoding="UTF-8"?>')
  L.push('<dokument xmlns="http://www.financnasprava.sk/kvdph/2025">')

  // Hlavicka
  L.push('  <hlavicka>')
  L.push(`    <dic>${escapeXml(company.dic)}</dic>`)
  L.push(`    <icDph>${escapeXml(company.ic_dph)}</icDph>`)
  L.push(`    <nazovDanSubjektu>${escapeXml(company.name)}</nazovDanSubjektu>`)
  L.push(`    <ulica>${escapeXml(company.street || "")}</ulica>`)
  L.push(`    <mesto>${escapeXml(company.city || "")}</mesto>`)
  L.push(`    <psc>${escapeXml(company.zip || "")}</psc>`)
  L.push('    <stat>SK</stat>')
  L.push(`    <rok>${period.year}</rok>`)
  if (period.month) {
    L.push(`    <mesiac>${String(period.month).padStart(2, "0")}</mesiac>`)
  }
  if (period.quarter) {
    L.push(`    <stvrrok>${period.quarter}</stvrrok>`)
  }
  L.push(`    <druhVykazu>${recognitionCode(recognitionType)}</druhVykazu>`)
  L.push(`    <datumPodania>${new Date().toISOString().split("T")[0]}</datumPodania>`)
  L.push('  </hlavicka>')

  // Telo
  L.push('  <telo>')

  const sections: Array<{ key: keyof KVDPHData; tag: string }> = [
    { key: "a1", tag: "castA1" },
    { key: "a2", tag: "castA2" },
    { key: "b1", tag: "castB1" },
    { key: "b2", tag: "castB2" },
    { key: "b3", tag: "castB3" },
    { key: "c1", tag: "castC1" },
    { key: "c2", tag: "castC2" },
    { key: "d1", tag: "castD1" },
    { key: "d2", tag: "castD2" },
  ]

  for (const { key, tag } of sections) {
    const records = (kvdphData[key] as KVDPHRecord[]) || []
    L.push(`    <${tag}>`)
    L.push(`      <pocetZaznamov>${records.length}</pocetZaznamov>`)
    for (const record of records) {
      L.push('      <zaznam>')
      L.push(`        <icDphOdberatela>${escapeXml(record.ic_dph)}</icDphOdberatela>`)
      L.push(`        <cisloFaktury>${escapeXml(record.invoice_number)}</cisloFaktury>`)
      L.push(`        <datumFaktury>${escapeXml(record.invoice_date)}</datumFaktury>`)
      L.push(`        <zakladDane>${fmt(record.vat_base)}</zakladDane>`)
      L.push(`        <sumaDane>${fmt(record.vat_amount)}</sumaDane>`)
      L.push(`        <sadzbaDane>${record.vat_rate}</sadzbaDane>`)
      L.push('      </zaznam>')
    }
    L.push(`    </${tag}>`)
  }

  L.push('  </telo>')
  L.push('</dokument>')

  return L.join("\n")
}

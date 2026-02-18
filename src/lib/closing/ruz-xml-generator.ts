/**
 * RUZ XML Generator
 *
 * Generates XML for submission to Register uctovnych zavierok (RUZ)
 * per Slovak Financial Statements specification.
 *
 * Includes Suvaha Uc 1-01 and Vykaz ziskov a strat Uc 2-01 data.
 */

import type { BalanceSheetData, BalanceSheetLine } from "./balance-sheet"
import type { ProfitLossData, ProfitLossLine } from "./profit-loss"

// ---- Types ----

export interface RuzCompanyInfo {
  name: string
  ico: string
  dic: string
  ic_dph: string
  address?: string
  city?: string
  zip?: string
  legal_form?: string
  sk_nace?: string
  size_category?: "mikro" | "mala" | "velka"
}

export interface RuzFiscalYear {
  year: number
  start_date: string
  end_date: string
}

// ---- XML Helper functions ----

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

function formatDateXml(dateStr: string): string {
  // Ensure YYYY-MM-DD format
  return dateStr.substring(0, 10)
}

// ---- Balance Sheet XML generation ----

function generateBalanceSheetLines(
  lines: BalanceSheetLine[],
  indent: string
): string[] {
  const result: string[] = []

  for (const line of lines) {
    result.push(`${indent}<Riadok>`)
    result.push(`${indent}  <Oznacenie>${escapeXml(line.oznacenie)}</Oznacenie>`)
    result.push(`${indent}  <CisloRiadku>${line.riadok}</CisloRiadku>`)
    result.push(`${indent}  <Brutto>${formatAmount(line.brutto)}</Brutto>`)
    result.push(`${indent}  <Korekcia>${formatAmount(line.korekcia)}</Korekcia>`)
    result.push(`${indent}  <Netto>${formatAmount(line.netto)}</Netto>`)
    result.push(`${indent}  <PredchadzajuceObdobie>${formatAmount(line.predchadzajuce_obdobie)}</PredchadzajuceObdobie>`)
    result.push(`${indent}</Riadok>`)

    if (line.children) {
      result.push(...generateBalanceSheetLines(line.children, indent))
    }
  }

  return result
}

// ---- Profit & Loss XML generation ----

function generateProfitLossLines(
  lines: ProfitLossLine[],
  indent: string
): string[] {
  const result: string[] = []

  for (const line of lines) {
    result.push(`${indent}<Riadok>`)
    result.push(`${indent}  <Oznacenie>${escapeXml(line.oznacenie)}</Oznacenie>`)
    result.push(`${indent}  <CisloRiadku>${line.riadok}</CisloRiadku>`)
    result.push(`${indent}  <BezneObdobie>${formatAmount(line.bezne_obdobie)}</BezneObdobie>`)
    result.push(`${indent}  <PredchadzajuceObdobie>${formatAmount(line.predchadzajuce_obdobie)}</PredchadzajuceObdobie>`)
    result.push(`${indent}</Riadok>`)

    if (line.children) {
      result.push(...generateProfitLossLines(line.children, indent))
    }
  }

  return result
}

// ---- Main Export ----

export function generateRuzXml(
  companyInfo: RuzCompanyInfo,
  balanceSheet: BalanceSheetData,
  profitLoss: ProfitLossData,
  fiscalYear: RuzFiscalYear
): string {
  const lines: string[] = []

  // XML declaration
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')

  // Root element with namespace
  lines.push('<UctovnaZavierka xmlns="http://www.registeruz.sk/uz/doc"')
  lines.push('  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">')

  // Document header
  lines.push("  <Hlavicka>")
  lines.push(`    <TypDokumentu>uctovna_zavierka</TypDokumentu>`)
  lines.push(`    <DruhZavierky>riadna</DruhZavierky>`)
  lines.push(`    <DatumZostavenia>${formatDateXml(new Date().toISOString())}</DatumZostavenia>`)
  lines.push(`    <ObdobieOd>${formatDateXml(fiscalYear.start_date)}</ObdobieOd>`)
  lines.push(`    <ObdobieDo>${formatDateXml(fiscalYear.end_date)}</ObdobieDo>`)
  lines.push(`    <PredchadzajuceObdobieOd>${fiscalYear.year - 1}-01-01</PredchadzajuceObdobieOd>`)
  lines.push(`    <PredchadzajuceObdobieDo>${fiscalYear.year - 1}-12-31</PredchadzajuceObdobieDo>`)
  lines.push("  </Hlavicka>")

  // Company identification
  lines.push("  <Identifikacia>")
  lines.push(`    <ObchodneMeno>${escapeXml(companyInfo.name)}</ObchodneMeno>`)
  lines.push(`    <ICO>${escapeXml(companyInfo.ico)}</ICO>`)
  lines.push(`    <DIC>${escapeXml(companyInfo.dic)}</DIC>`)
  if (companyInfo.ic_dph) {
    lines.push(`    <ICDPH>${escapeXml(companyInfo.ic_dph)}</ICDPH>`)
  }
  if (companyInfo.address) {
    lines.push(`    <Sidlo>`)
    lines.push(`      <Ulica>${escapeXml(companyInfo.address)}</Ulica>`)
    if (companyInfo.city) {
      lines.push(`      <Obec>${escapeXml(companyInfo.city)}</Obec>`)
    }
    if (companyInfo.zip) {
      lines.push(`      <PSC>${escapeXml(companyInfo.zip)}</PSC>`)
    }
    lines.push(`    </Sidlo>`)
  }
  if (companyInfo.legal_form) {
    lines.push(`    <PravnaForma>${escapeXml(companyInfo.legal_form)}</PravnaForma>`)
  }
  if (companyInfo.sk_nace) {
    lines.push(`    <SKNACE>${escapeXml(companyInfo.sk_nace)}</SKNACE>`)
  }
  if (companyInfo.size_category) {
    const sizeMap: Record<string, string> = {
      mikro: "1",
      mala: "2",
      velka: "3",
    }
    lines.push(`    <VelkostnaKategoria>${sizeMap[companyInfo.size_category] || "2"}</VelkostnaKategoria>`)
  }
  lines.push("  </Identifikacia>")

  // Balance Sheet (Suvaha) - Uc 1-01
  lines.push("  <Suvaha>")
  lines.push(`    <OznaczenieVykazu>Uc 1-01</OznaczenieVykazu>`)

  // AKTIVA
  lines.push("    <Aktiva>")
  lines.push(...generateBalanceSheetLines(balanceSheet.aktiva, "      "))

  // AKTIVA total
  lines.push("      <AktivaSpolu>")
  lines.push(`        <Brutto>${formatAmount(balanceSheet.aktiva_spolu.brutto)}</Brutto>`)
  lines.push(`        <Korekcia>${formatAmount(balanceSheet.aktiva_spolu.korekcia)}</Korekcia>`)
  lines.push(`        <Netto>${formatAmount(balanceSheet.aktiva_spolu.netto)}</Netto>`)
  lines.push(`        <PredchadzajuceObdobie>${formatAmount(balanceSheet.aktiva_spolu.predchadzajuce_obdobie)}</PredchadzajuceObdobie>`)
  lines.push("      </AktivaSpolu>")
  lines.push("    </Aktiva>")

  // PASIVA
  lines.push("    <Pasiva>")
  lines.push(...generateBalanceSheetLines(balanceSheet.pasiva, "      "))

  // PASIVA total
  lines.push("      <PasivaSpolu>")
  lines.push(`        <Netto>${formatAmount(balanceSheet.pasiva_spolu.netto)}</Netto>`)
  lines.push(`        <PredchadzajuceObdobie>${formatAmount(balanceSheet.pasiva_spolu.predchadzajuce_obdobie)}</PredchadzajuceObdobie>`)
  lines.push("      </PasivaSpolu>")
  lines.push("    </Pasiva>")

  lines.push("  </Suvaha>")

  // Profit & Loss (Vykaz ziskov a strat) - Uc 2-01
  lines.push("  <VykazZiskovAStrat>")
  lines.push(`    <OznaczenieVykazu>Uc 2-01</OznaczenieVykazu>`)

  // P&L lines
  lines.push("    <Udaje>")
  lines.push(...generateProfitLossLines(profitLoss.lines, "      "))
  lines.push("    </Udaje>")

  // P&L summary
  lines.push("    <Suhrn>")
  lines.push(`      <ObchodnaMarza>`)
  lines.push(`        <BezneObdobie>${formatAmount(profitLoss.obchodna_marza.bezne)}</BezneObdobie>`)
  lines.push(`        <PredchadzajuceObdobie>${formatAmount(profitLoss.obchodna_marza.predchadzajuce)}</PredchadzajuceObdobie>`)
  lines.push(`      </ObchodnaMarza>`)
  lines.push(`      <PridanaHodnota>`)
  lines.push(`        <BezneObdobie>${formatAmount(profitLoss.pridana_hodnota.bezne)}</BezneObdobie>`)
  lines.push(`        <PredchadzajuceObdobie>${formatAmount(profitLoss.pridana_hodnota.predchadzajuce)}</PredchadzajuceObdobie>`)
  lines.push(`      </PridanaHodnota>`)
  lines.push(`      <VHHospodarska>`)
  lines.push(`        <BezneObdobie>${formatAmount(profitLoss.vh_hospodarska.bezne)}</BezneObdobie>`)
  lines.push(`        <PredchadzajuceObdobie>${formatAmount(profitLoss.vh_hospodarska.predchadzajuce)}</PredchadzajuceObdobie>`)
  lines.push(`      </VHHospodarska>`)
  lines.push(`      <VHFinancna>`)
  lines.push(`        <BezneObdobie>${formatAmount(profitLoss.vh_financna.bezne)}</BezneObdobie>`)
  lines.push(`        <PredchadzajuceObdobie>${formatAmount(profitLoss.vh_financna.predchadzajuce)}</PredchadzajuceObdobie>`)
  lines.push(`      </VHFinancna>`)
  lines.push(`      <VHZaObdobie>`)
  lines.push(`        <BezneObdobie>${formatAmount(profitLoss.vh_za_obdobie.bezne)}</BezneObdobie>`)
  lines.push(`        <PredchadzajuceObdobie>${formatAmount(profitLoss.vh_za_obdobie.predchadzajuce)}</PredchadzajuceObdobie>`)
  lines.push(`      </VHZaObdobie>`)
  lines.push("    </Suhrn>")

  lines.push("  </VykazZiskovAStrat>")

  // Close root
  lines.push("</UctovnaZavierka>")

  return lines.join("\n")
}

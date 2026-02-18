/**
 * Notes to Financial Statements Generator (Poznamky k uctovnej zavierke)
 *
 * Generates structured notes sections per Slovak accounting requirements.
 */

import type { BalanceSheetData } from "./balance-sheet"
import type { ProfitLossData } from "./profit-loss"

// ---- Types ----

export interface CompanyInfo {
  name: string
  ico: string
  dic: string
  ic_dph: string
  address?: string
  legal_form?: string
  business_type?: string
  accounting_type?: string
  registration_number?: string
  date_of_establishment?: string
  statutory_body?: string
}

export interface NotesSection {
  id: string
  title: string
  content: string
  order: number
  editable: boolean
}

export interface NotesData {
  sections: NotesSection[]
  fiscal_year: string
  generated_at: string
  company_name: string
}

// ---- Helper functions ----

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

// ---- Section Generators ----

function generateIdentification(company: CompanyInfo, fiscalYear: string): string {
  const lines: string[] = []

  lines.push("<h3>1. Identifikacia uctovnej jednotky</h3>")
  lines.push("<table>")
  lines.push(`<tr><td><strong>Obchodne meno:</strong></td><td>${company.name}</td></tr>`)
  lines.push(`<tr><td><strong>ICO:</strong></td><td>${company.ico}</td></tr>`)
  lines.push(`<tr><td><strong>DIC:</strong></td><td>${company.dic}</td></tr>`)
  if (company.ic_dph) {
    lines.push(`<tr><td><strong>IC DPH:</strong></td><td>${company.ic_dph}</td></tr>`)
  }
  if (company.address) {
    lines.push(`<tr><td><strong>Sidlo:</strong></td><td>${company.address}</td></tr>`)
  }
  if (company.legal_form) {
    lines.push(`<tr><td><strong>Pravna forma:</strong></td><td>${company.legal_form}</td></tr>`)
  }
  if (company.business_type) {
    lines.push(`<tr><td><strong>Predmet podnikania:</strong></td><td>${company.business_type}</td></tr>`)
  }
  if (company.registration_number) {
    lines.push(`<tr><td><strong>Registracia:</strong></td><td>${company.registration_number}</td></tr>`)
  }
  if (company.date_of_establishment) {
    lines.push(`<tr><td><strong>Datum vzniku:</strong></td><td>${company.date_of_establishment}</td></tr>`)
  }
  if (company.statutory_body) {
    lines.push(`<tr><td><strong>Statutarny organ:</strong></td><td>${company.statutory_body}</td></tr>`)
  }
  lines.push(`<tr><td><strong>Uctovne obdobie:</strong></td><td>01.01.${fiscalYear} - 31.12.${fiscalYear}</td></tr>`)
  lines.push("</table>")

  lines.push("<p>Uctovna zavierka bola zostavena za uctovne obdobie, ktore sa zhoduje s kalendarnym rokom.</p>")

  return lines.join("\n")
}

function generateAccountingMethods(company: CompanyInfo): string {
  const lines: string[] = []

  lines.push("<h3>2. Uctovne metody a zasady</h3>")

  lines.push("<h4>2.1 Sposob vedenia uctovnictva</h4>")
  const accountingType = company.accounting_type === "jednoduche" ? "jednoduche" : "podvojne"
  lines.push(`<p>Uctovna jednotka uplatňuje sustavu ${accountingType}ho uctovnictva v zmysle zakona c. 431/2002 Z. z. o uctovnictve v zneni neskorsich predpisov.</p>`)

  lines.push("<h4>2.2 Dlhodoby nehmotny majetok</h4>")
  lines.push("<p>Dlhodoby nehmotny majetok sa uctuje v obstaravacich cenach. Dlhodoby nehmotny majetok sa odpisuje rovnomerne pocas doby jeho pouzitelnosti, ktora je stanovena na zaklade odhadu uctovnej jednotky.</p>")

  lines.push("<h4>2.3 Dlhodoby hmotny majetok</h4>")
  lines.push("<p>Dlhodoby hmotny majetok sa uctuje v obstaravacich cenach znizenych o oprávky a opravne polozky. Odpisy su pocitane rovnomernou metodou pocas predpokladanej doby zivotnosti majetku.</p>")

  lines.push("<h4>2.4 Zasoby</h4>")
  lines.push("<p>Zasoby sa oceňuju obstaravacimi cenami vrátane nakladov suvisiacich s obstaraním. Ubytek zasob sa uctuje sposobom A (priebezne uctovanie o zasobach).</p>")

  lines.push("<h4>2.5 Pohladavky</h4>")
  lines.push("<p>Pohladavky sa pri vzniku oceňuju menovitou hodnotou. Opravne polozky k pochybnym pohladavkam sa tvoria na zaklade individualneho posudenia dobytnosti pohladavok.</p>")

  lines.push("<h4>2.6 Zavazky</h4>")
  lines.push("<p>Zavazky sa pri vzniku oceňuju menovitou hodnotou. Dlhodobe zavazky sa oceňuju suctovou hodnotou.</p>")

  lines.push("<h4>2.7 Cudzia mena</h4>")
  lines.push("<p>Majetok a zavazky vyjadrene v cudzej mene sa prepocitavaju na euro kurzom ECB platnym v den uctovneho pripadu. Kurzove rozdiely sa uctuju vysledkovo.</p>")

  lines.push("<h4>2.8 Dan z prijmov</h4>")
  lines.push("<p>Dan z prijmov za bezne obdobie sa pocita v sulade so zakonom c. 595/2003 Z. z. o dani z prijmov. Odlozena dan sa uctuje z docasnych rozdielov medzi uctovnou hodnotou a danovou hodnotou majetku a zavazkov.</p>")

  return lines.join("\n")
}

function generateBalanceSheetNotes(bs: BalanceSheetData | null): string {
  const lines: string[] = []

  lines.push("<h3>3. Informacie k suvaze</h3>")

  if (!bs) {
    lines.push("<p>Udaje suvahy nie su k dispozicii.</p>")
    return lines.join("\n")
  }

  lines.push("<h4>3.1 Prehlad aktiv</h4>")
  lines.push("<table>")
  lines.push("<tr><th>Polozka</th><th>Brutto</th><th>Korekcia</th><th>Netto</th><th>Predch. obdobie</th></tr>")

  for (const item of bs.aktiva) {
    lines.push(`<tr>`)
    lines.push(`<td><strong>${item.oznacenie} ${item.nazov}</strong></td>`)
    lines.push(`<td>${formatMoney(item.brutto)}</td>`)
    lines.push(`<td>${formatMoney(item.korekcia)}</td>`)
    lines.push(`<td>${formatMoney(item.netto)}</td>`)
    lines.push(`<td>${formatMoney(item.predchadzajuce_obdobie)}</td>`)
    lines.push("</tr>")
  }

  lines.push(`<tr class="total">`)
  lines.push(`<td><strong>AKTIVA SPOLU</strong></td>`)
  lines.push(`<td><strong>${formatMoney(bs.aktiva_spolu.brutto)}</strong></td>`)
  lines.push(`<td><strong>${formatMoney(bs.aktiva_spolu.korekcia)}</strong></td>`)
  lines.push(`<td><strong>${formatMoney(bs.aktiva_spolu.netto)}</strong></td>`)
  lines.push(`<td><strong>${formatMoney(bs.aktiva_spolu.predchadzajuce_obdobie)}</strong></td>`)
  lines.push("</tr>")
  lines.push("</table>")

  lines.push("<h4>3.2 Prehlad pasiv</h4>")
  lines.push("<table>")
  lines.push("<tr><th>Polozka</th><th>Bezne obdobie</th><th>Predch. obdobie</th></tr>")

  for (const item of bs.pasiva) {
    lines.push(`<tr>`)
    lines.push(`<td><strong>${item.oznacenie} ${item.nazov}</strong></td>`)
    lines.push(`<td>${formatMoney(item.netto)}</td>`)
    lines.push(`<td>${formatMoney(item.predchadzajuce_obdobie)}</td>`)
    lines.push("</tr>")
  }

  lines.push(`<tr class="total">`)
  lines.push(`<td><strong>PASIVA SPOLU</strong></td>`)
  lines.push(`<td><strong>${formatMoney(bs.pasiva_spolu.netto)}</strong></td>`)
  lines.push(`<td><strong>${formatMoney(bs.pasiva_spolu.predchadzajuce_obdobie)}</strong></td>`)
  lines.push("</tr>")
  lines.push("</table>")

  // Balance check
  const difference = Math.abs(bs.aktiva_spolu.netto - bs.pasiva_spolu.netto)
  if (difference < 0.01) {
    lines.push("<p>Suvaha je vyvazena - aktiva sa rovnaju pasivam.</p>")
  } else {
    lines.push(`<p><strong>Upozornenie:</strong> Suvaha nie je vyvazena. Rozdiel medzi aktivami a pasivami je ${formatMoney(difference)}.</p>`)
  }

  return lines.join("\n")
}

function generateProfitLossNotes(pl: ProfitLossData | null): string {
  const lines: string[] = []

  lines.push("<h3>4. Informacie k vykazu ziskov a strat</h3>")

  if (!pl) {
    lines.push("<p>Udaje vykazu ziskov a strat nie su k dispozicii.</p>")
    return lines.join("\n")
  }

  lines.push("<h4>4.1 Klucove ukazovatele</h4>")
  lines.push("<table>")
  lines.push("<tr><th>Ukazovatel</th><th>Bezne obdobie</th><th>Predch. obdobie</th></tr>")
  lines.push(`<tr><td>Obchodna marza</td><td>${formatMoney(pl.obchodna_marza.bezne)}</td><td>${formatMoney(pl.obchodna_marza.predchadzajuce)}</td></tr>`)
  lines.push(`<tr><td>Pridana hodnota</td><td>${formatMoney(pl.pridana_hodnota.bezne)}</td><td>${formatMoney(pl.pridana_hodnota.predchadzajuce)}</td></tr>`)
  lines.push(`<tr><td>VH z hospodarskej cinnosti</td><td>${formatMoney(pl.vh_hospodarska.bezne)}</td><td>${formatMoney(pl.vh_hospodarska.predchadzajuce)}</td></tr>`)
  lines.push(`<tr><td>VH z financnej cinnosti</td><td>${formatMoney(pl.vh_financna.bezne)}</td><td>${formatMoney(pl.vh_financna.predchadzajuce)}</td></tr>`)
  lines.push(`<tr><td><strong>VH za uctovne obdobie</strong></td><td><strong>${formatMoney(pl.vh_za_obdobie.bezne)}</strong></td><td><strong>${formatMoney(pl.vh_za_obdobie.predchadzajuce)}</strong></td></tr>`)
  lines.push("</table>")

  // Year-over-year analysis
  if (pl.vh_za_obdobie.predchadzajuce !== 0) {
    const changePercent = ((pl.vh_za_obdobie.bezne - pl.vh_za_obdobie.predchadzajuce) / Math.abs(pl.vh_za_obdobie.predchadzajuce) * 100).toFixed(1)
    lines.push(`<p>Vysledok hospodarenia za uctovne obdobie sa oproti minulemu roku zmenil o ${changePercent} %.</p>`)
  }

  return lines.join("\n")
}

function generateCashFlowNotes(): string {
  const lines: string[] = []

  lines.push("<h3>5. Prehlad o penaznych tokoch (zjednoduseny)</h3>")
  lines.push("<p>Prehlad o penaznych tokoch uvadza prehlad pohybu penaznych prostriedkov uctovnej jednotky pocas uctovneho obdobia.</p>")

  lines.push("<table>")
  lines.push("<tr><th>Polozka</th><th>Suma</th></tr>")
  lines.push("<tr><td>A. Penazne toky z hospodarskej cinnosti</td><td>Udaje sa doplnia</td></tr>")
  lines.push("<tr><td>B. Penazne toky z investicnej cinnosti</td><td>Udaje sa doplnia</td></tr>")
  lines.push("<tr><td>C. Penazne toky z financnej cinnosti</td><td>Udaje sa doplnia</td></tr>")
  lines.push("<tr><td><strong>Cisty prirastok/ubytek penaznych prostriedkov</strong></td><td>Udaje sa doplnia</td></tr>")
  lines.push("</table>")

  lines.push("<p><em>Poznamka: Detailny prehlad o penaznych tokoch bude doplneny podla skutocnych udajov.</em></p>")

  return lines.join("\n")
}

function generateEmployeeNotes(): string {
  const lines: string[] = []

  lines.push("<h3>6. Informacie o zamestnancoch</h3>")

  lines.push("<table>")
  lines.push("<tr><th>Ukazovatel</th><th>Bezne obdobie</th><th>Predch. obdobie</th></tr>")
  lines.push("<tr><td>Priemerny pocet zamestnancov</td><td>Udaje sa doplnia</td><td>Udaje sa doplnia</td></tr>")
  lines.push("<tr><td>Z toho riadiaci pracovnici</td><td>Udaje sa doplnia</td><td>Udaje sa doplnia</td></tr>")
  lines.push("<tr><td>Osobne naklady celkom</td><td>Udaje sa doplnia</td><td>Udaje sa doplnia</td></tr>")
  lines.push("<tr><td>Z toho mzdove naklady</td><td>Udaje sa doplnia</td><td>Udaje sa doplnia</td></tr>")
  lines.push("<tr><td>Z toho socialne naklady</td><td>Udaje sa doplnia</td><td>Udaje sa doplnia</td></tr>")
  lines.push("</table>")

  lines.push("<p><em>Poznamka: Udaje o zamestnancoch budu doplnene podla skutocneho stavu.</em></p>")

  return lines.join("\n")
}

function generatePostClosingEvents(): string {
  const lines: string[] = []

  lines.push("<h3>7. Vyznamne udalosti po dni, ku ktoremu sa zostavuje uctovna zavierka</h3>")
  lines.push("<p>Po dni, ku ktoremu sa zostavuje uctovna zavierka, nenastali ziadne vyznamne udalosti, ktore by ovplyvnili verny obraz o skutocnostiach, ktore su predmetom uctovnictva, a o financnej situacii uctovnej jednotky.</p>")
  lines.push("<p><em>Poznamka: Ak nastali vyznamne udalosti, doplnte ich popis a dopad na uctovnu zavierku.</em></p>")

  return lines.join("\n")
}

// ---- Main Export ----

export function generateNotes(
  companyId: string,
  fiscalYear: string,
  balanceSheet: BalanceSheetData | null,
  profitLoss: ProfitLossData | null,
  companyInfo: CompanyInfo
): NotesData {
  const sections: NotesSection[] = [
    {
      id: "identification",
      title: "1. Identifikacia uctovnej jednotky",
      content: generateIdentification(companyInfo, fiscalYear),
      order: 1,
      editable: true,
    },
    {
      id: "accounting_methods",
      title: "2. Uctovne metody a zasady",
      content: generateAccountingMethods(companyInfo),
      order: 2,
      editable: true,
    },
    {
      id: "balance_sheet_notes",
      title: "3. Informacie k suvaze",
      content: generateBalanceSheetNotes(balanceSheet),
      order: 3,
      editable: true,
    },
    {
      id: "profit_loss_notes",
      title: "4. Informacie k vykazu ziskov a strat",
      content: generateProfitLossNotes(profitLoss),
      order: 4,
      editable: true,
    },
    {
      id: "cash_flow",
      title: "5. Prehlad o penaznych tokoch",
      content: generateCashFlowNotes(),
      order: 5,
      editable: true,
    },
    {
      id: "employees",
      title: "6. Informacie o zamestnancoch",
      content: generateEmployeeNotes(),
      order: 6,
      editable: true,
    },
    {
      id: "post_closing_events",
      title: "7. Vyznamne udalosti po zavierke",
      content: generatePostClosingEvents(),
      order: 7,
      editable: true,
    },
  ]

  return {
    sections,
    fiscal_year: fiscalYear,
    generated_at: new Date().toISOString(),
    company_name: companyInfo.name,
  }
}

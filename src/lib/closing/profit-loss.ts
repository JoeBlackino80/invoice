/**
 * Profit & Loss Calculator (Vykaz ziskov a strat) per Slovak accounting standard Uc 2-01
 *
 * Structure per Slovak P&L standard with all required lines,
 * subtotals for obchodna marza, pridana hodnota, VH z hospodarskej cinnosti,
 * VH z financnej cinnosti, VH za uctovne obdobie.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ---- Types ----

export interface ProfitLossLine {
  oznacenie: string
  nazov: string
  riadok: number
  bezne_obdobie: number
  predchadzajuce_obdobie: number
  ucty: string[]
  children?: ProfitLossLine[]
  is_subtotal?: boolean
  is_highlight?: boolean
}

export interface ProfitLossData {
  lines: ProfitLossLine[]
  obchodna_marza: { bezne: number; predchadzajuce: number }
  pridana_hodnota: { bezne: number; predchadzajuce: number }
  vh_hospodarska: { bezne: number; predchadzajuce: number }
  vh_financna: { bezne: number; predchadzajuce: number }
  vh_bezna_cinnost: { bezne: number; predchadzajuce: number }
  vh_mimoriadna: { bezne: number; predchadzajuce: number }
  vh_za_obdobie: { bezne: number; predchadzajuce: number }
  vh_po_zdaneni: { bezne: number; predchadzajuce: number }
  fiscal_year: string
  date_from: string
  date_to: string
  generated_at: string
}

// ---- P&L Line Definitions per Uc 2-01 ----

interface PLLineDefinition {
  oznacenie: string
  nazov: string
  riadok: number
  revenue_accounts: string[]
  expense_accounts: string[]
  is_subtotal?: boolean
  is_highlight?: boolean
  children?: PLLineDefinition[]
  calculation?: string // formula reference
}

const PL_LINES: PLLineDefinition[] = [
  // I. Trzby z predaja tovaru
  {
    oznacenie: "I.",
    nazov: "Trzby z predaja tovaru",
    riadok: 1,
    revenue_accounts: ["604"],
    expense_accounts: [],
  },
  // A. Naklady vynalozene na obstaranie predaneho tovaru
  {
    oznacenie: "A.",
    nazov: "Naklady vynalozene na obstaranie predaneho tovaru",
    riadok: 2,
    revenue_accounts: [],
    expense_accounts: ["504"],
  },
  // + Obchodna marza (r.1 - r.2)
  {
    oznacenie: "+",
    nazov: "Obchodna marza (r.01 - r.02)",
    riadok: 3,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    is_highlight: true,
    calculation: "r1-r2",
  },
  // II. Vyroba
  {
    oznacenie: "II.",
    nazov: "Vyroba",
    riadok: 4,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    children: [
      {
        oznacenie: "II.1.",
        nazov: "Trzby z predaja vlastnych vyrobkov a sluzieb",
        riadok: 5,
        revenue_accounts: ["601", "602"],
        expense_accounts: [],
      },
      {
        oznacenie: "II.2.",
        nazov: "Zmeny stavu vnutroorganizacnych zasob",
        riadok: 6,
        revenue_accounts: ["611", "612", "613"],
        expense_accounts: [],
      },
      {
        oznacenie: "II.3.",
        nazov: "Aktivacia",
        riadok: 7,
        revenue_accounts: ["621", "622", "623", "624"],
        expense_accounts: [],
      },
    ],
  },
  // B. Vyrobna spotreba
  {
    oznacenie: "B.",
    nazov: "Vyrobna spotreba",
    riadok: 8,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    children: [
      {
        oznacenie: "B.1.",
        nazov: "Spotreba materialu, energie a ostatnych neskladovatelnych dodavok",
        riadok: 9,
        revenue_accounts: [],
        expense_accounts: ["501", "502", "503"],
      },
      {
        oznacenie: "B.2.",
        nazov: "Sluzby",
        riadok: 10,
        revenue_accounts: [],
        expense_accounts: ["511", "512", "513", "518"],
      },
    ],
  },
  // + Pridana hodnota (r.3 + r.4 - r.8)
  {
    oznacenie: "+",
    nazov: "Pridana hodnota (r.03 + r.04 - r.08)",
    riadok: 11,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    is_highlight: true,
    calculation: "r3+r4-r8",
  },
  // C. Osobne naklady
  {
    oznacenie: "C.",
    nazov: "Osobne naklady",
    riadok: 12,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    children: [
      {
        oznacenie: "C.1.",
        nazov: "Mzdove naklady",
        riadok: 13,
        revenue_accounts: [],
        expense_accounts: ["521", "522"],
      },
      {
        oznacenie: "C.2.",
        nazov: "Odmeny clenov organov spolocnosti a druzstva",
        riadok: 14,
        revenue_accounts: [],
        expense_accounts: ["523"],
      },
      {
        oznacenie: "C.3.",
        nazov: "Naklady na socialne poistenie",
        riadok: 15,
        revenue_accounts: [],
        expense_accounts: ["524", "525", "526"],
      },
      {
        oznacenie: "C.4.",
        nazov: "Socialne naklady",
        riadok: 16,
        revenue_accounts: [],
        expense_accounts: ["527", "528"],
      },
    ],
  },
  // D. Dane a poplatky
  {
    oznacenie: "D.",
    nazov: "Dane a poplatky",
    riadok: 17,
    revenue_accounts: [],
    expense_accounts: ["531", "532", "538"],
  },
  // E. Odpisy a opravne polozky k dlhodobemu nehmotnemu a hmotnemu majetku
  {
    oznacenie: "E.",
    nazov: "Odpisy a opravne polozky k dlhodobemu nehmotnemu a hmotnemu majetku",
    riadok: 18,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    children: [
      {
        oznacenie: "E.1.",
        nazov: "Odpisy dlhodobeho nehmotneho a hmotneho majetku",
        riadok: 19,
        revenue_accounts: [],
        expense_accounts: ["551"],
      },
      {
        oznacenie: "E.2.",
        nazov: "Opravne polozky k dlhodobemu nehmotnemu a hmotnemu majetku",
        riadok: 20,
        revenue_accounts: [],
        expense_accounts: ["553"],
      },
    ],
  },
  // III. Trzby z predaja dlhodobeho majetku a materialu
  {
    oznacenie: "III.",
    nazov: "Trzby z predaja dlhodobeho majetku a materialu",
    riadok: 21,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    children: [
      {
        oznacenie: "III.1.",
        nazov: "Trzby z predaja dlhodobeho majetku",
        riadok: 22,
        revenue_accounts: ["641"],
        expense_accounts: [],
      },
      {
        oznacenie: "III.2.",
        nazov: "Trzby z predaja materialu",
        riadok: 23,
        revenue_accounts: ["642"],
        expense_accounts: [],
      },
    ],
  },
  // F. Zostatova cena predaneho dlhodobeho majetku a predaneho materialu
  {
    oznacenie: "F.",
    nazov: "Zostatova cena predaneho dlhodobeho majetku a predaneho materialu",
    riadok: 24,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    children: [
      {
        oznacenie: "F.1.",
        nazov: "Zostatova cena predaneho dlhodobeho majetku",
        riadok: 25,
        revenue_accounts: [],
        expense_accounts: ["541"],
      },
      {
        oznacenie: "F.2.",
        nazov: "Predany material",
        riadok: 26,
        revenue_accounts: [],
        expense_accounts: ["542"],
      },
    ],
  },
  // G. Tvorba a zuctovanie opravnych poloziek k pohladavkam
  {
    oznacenie: "G.",
    nazov: "Tvorba a zuctovanie opravnych poloziek k pohladavkam",
    riadok: 27,
    revenue_accounts: [],
    expense_accounts: ["547"],
  },
  // IV. Ostatne vynosy z hospodarskej cinnosti
  {
    oznacenie: "IV.",
    nazov: "Ostatne vynosy z hospodarskej cinnosti",
    riadok: 28,
    revenue_accounts: ["644", "645", "646", "648"],
    expense_accounts: [],
  },
  // H. Ostatne naklady na hospodarsku cinnost
  {
    oznacenie: "H.",
    nazov: "Ostatne naklady na hospodarsku cinnost",
    riadok: 29,
    revenue_accounts: [],
    expense_accounts: ["544", "545", "546", "548", "549"],
  },
  // V. Prevod vynosov z hospodarskej cinnosti
  {
    oznacenie: "V.",
    nazov: "Prevod vynosov z hospodarskej cinnosti",
    riadok: 30,
    revenue_accounts: ["697"],
    expense_accounts: [],
  },
  // I. Prevod nakladov na hospodarsku cinnost
  {
    oznacenie: "I.",
    nazov: "Prevod nakladov na hospodarsku cinnost",
    riadok: 31,
    revenue_accounts: [],
    expense_accounts: ["597"],
  },
  // * Vysledok hospodarenia z hospodarskej cinnosti
  {
    oznacenie: "*",
    nazov: "Vysledok hospodarenia z hospodarskej cinnosti",
    riadok: 32,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    is_highlight: true,
    calculation: "vh_hospodarska",
  },
  // VI. Trzby z predaja cennych papierov a podielov
  {
    oznacenie: "VI.",
    nazov: "Trzby z predaja cennych papierov a podielov",
    riadok: 33,
    revenue_accounts: ["661"],
    expense_accounts: [],
  },
  // J. Predane cenné papiere a podiely
  {
    oznacenie: "J.",
    nazov: "Predane cenné papiere a podiely",
    riadok: 34,
    revenue_accounts: [],
    expense_accounts: ["561"],
  },
  // VII. Vynosy z dlhodobeho financneho majetku
  {
    oznacenie: "VII.",
    nazov: "Vynosy z dlhodobeho financneho majetku",
    riadok: 35,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    children: [
      {
        oznacenie: "VII.1.",
        nazov: "Vynosy z cennych papierov a podielov v dcerskej uctovnej jednotke a v spolocnosti s podstatnym vplyvom",
        riadok: 36,
        revenue_accounts: ["665"],
        expense_accounts: [],
      },
      {
        oznacenie: "VII.2.",
        nazov: "Vynosy z ostatnych dlhodobych cennych papierov a podielov",
        riadok: 37,
        revenue_accounts: ["665"],
        expense_accounts: [],
      },
      {
        oznacenie: "VII.3.",
        nazov: "Vynosy z ostatneho dlhodobeho financneho majetku",
        riadok: 38,
        revenue_accounts: ["665"],
        expense_accounts: [],
      },
    ],
  },
  // VIII. Vynosy z kratkodobeho financneho majetku
  {
    oznacenie: "VIII.",
    nazov: "Vynosy z kratkodobeho financneho majetku",
    riadok: 39,
    revenue_accounts: ["666"],
    expense_accounts: [],
  },
  // K. Naklady na kratkodoby financny majetok
  {
    oznacenie: "K.",
    nazov: "Naklady na kratkodoby financny majetok",
    riadok: 40,
    revenue_accounts: [],
    expense_accounts: ["566"],
  },
  // IX. Vynosy z precenenia cennych papierov a vynosy z derivatovych operacii
  {
    oznacenie: "IX.",
    nazov: "Vynosy z precenenia cennych papierov a vynosy z derivatovych operacii",
    riadok: 41,
    revenue_accounts: ["664"],
    expense_accounts: [],
  },
  // L. Naklady na precenenie cennych papierov a naklady na derivatove operacie
  {
    oznacenie: "L.",
    nazov: "Naklady na precenenie cennych papierov a naklady na derivatove operacie",
    riadok: 42,
    revenue_accounts: [],
    expense_accounts: ["564"],
  },
  // X. Vynosove uroky
  {
    oznacenie: "X.",
    nazov: "Vynosove uroky",
    riadok: 43,
    revenue_accounts: ["662"],
    expense_accounts: [],
  },
  // M. Nakladove uroky
  {
    oznacenie: "M.",
    nazov: "Nakladove uroky",
    riadok: 44,
    revenue_accounts: [],
    expense_accounts: ["562"],
  },
  // XI. Kurzove zisky
  {
    oznacenie: "XI.",
    nazov: "Kurzove zisky",
    riadok: 45,
    revenue_accounts: ["663"],
    expense_accounts: [],
  },
  // N. Kurzove straty
  {
    oznacenie: "N.",
    nazov: "Kurzove straty",
    riadok: 46,
    revenue_accounts: [],
    expense_accounts: ["563"],
  },
  // XII. Ostatne vynosy z financnej cinnosti
  {
    oznacenie: "XII.",
    nazov: "Ostatne vynosy z financnej cinnosti",
    riadok: 47,
    revenue_accounts: ["668"],
    expense_accounts: [],
  },
  // O. Ostatne naklady na financnu cinnost
  {
    oznacenie: "O.",
    nazov: "Ostatne naklady na financnu cinnost",
    riadok: 48,
    revenue_accounts: [],
    expense_accounts: ["568", "569"],
  },
  // XIII. Prevod financnych vynosov
  {
    oznacenie: "XIII.",
    nazov: "Prevod financnych vynosov",
    riadok: 49,
    revenue_accounts: ["698"],
    expense_accounts: [],
  },
  // P. Prevod financnych nakladov
  {
    oznacenie: "P.",
    nazov: "Prevod financnych nakladov",
    riadok: 50,
    revenue_accounts: [],
    expense_accounts: ["598"],
  },
  // * Vysledok hospodarenia z financnej cinnosti
  {
    oznacenie: "*",
    nazov: "Vysledok hospodarenia z financnej cinnosti",
    riadok: 51,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    is_highlight: true,
    calculation: "vh_financna",
  },
  // ** Vysledok hospodarenia z beznej cinnosti pred zdanenim
  {
    oznacenie: "**",
    nazov: "Vysledok hospodarenia z beznej cinnosti pred zdanenim",
    riadok: 52,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    is_highlight: true,
    calculation: "vh_bezna_pred",
  },
  // Q. Dan z prijmov z beznej cinnosti
  {
    oznacenie: "Q.",
    nazov: "Dan z prijmov z beznej cinnosti",
    riadok: 53,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    children: [
      {
        oznacenie: "Q.1.",
        nazov: "Dan z prijmov z beznej cinnosti - splatna",
        riadok: 54,
        revenue_accounts: [],
        expense_accounts: ["591"],
      },
      {
        oznacenie: "Q.2.",
        nazov: "Dan z prijmov z beznej cinnosti - odlozena",
        riadok: 55,
        revenue_accounts: [],
        expense_accounts: ["592"],
      },
    ],
  },
  // ** Vysledok hospodarenia z beznej cinnosti po zdaneni
  {
    oznacenie: "**",
    nazov: "Vysledok hospodarenia z beznej cinnosti po zdaneni",
    riadok: 56,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    is_highlight: true,
    calculation: "vh_bezna_po",
  },
  // XIV. Mimoriadne vynosy
  {
    oznacenie: "XIV.",
    nazov: "Mimoriadne vynosy",
    riadok: 57,
    revenue_accounts: ["688"],
    expense_accounts: [],
  },
  // R. Mimoriadne naklady
  {
    oznacenie: "R.",
    nazov: "Mimoriadne naklady",
    riadok: 58,
    revenue_accounts: [],
    expense_accounts: ["588"],
  },
  // S. Dan z prijmov z mimoriadnej cinnosti
  {
    oznacenie: "S.",
    nazov: "Dan z prijmov z mimoriadnej cinnosti",
    riadok: 59,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    children: [
      {
        oznacenie: "S.1.",
        nazov: "Dan z prijmov z mimoriadnej cinnosti - splatna",
        riadok: 60,
        revenue_accounts: [],
        expense_accounts: ["593"],
      },
      {
        oznacenie: "S.2.",
        nazov: "Dan z prijmov z mimoriadnej cinnosti - odlozena",
        riadok: 61,
        revenue_accounts: [],
        expense_accounts: ["594"],
      },
    ],
  },
  // * Vysledok hospodarenia z mimoriadnej cinnosti
  {
    oznacenie: "*",
    nazov: "Vysledok hospodarenia z mimoriadnej cinnosti",
    riadok: 62,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    is_highlight: true,
    calculation: "vh_mimoriadna",
  },
  // T. Prevod podielov na vysledku hospodarenia spolocnikom
  {
    oznacenie: "T.",
    nazov: "Prevod podielov na vysledku hospodarenia spolocnikom",
    riadok: 63,
    revenue_accounts: [],
    expense_accounts: ["596"],
  },
  // *** Vysledok hospodarenia za uctovne obdobie
  {
    oznacenie: "***",
    nazov: "Vysledok hospodarenia za uctovne obdobie",
    riadok: 64,
    revenue_accounts: [],
    expense_accounts: [],
    is_subtotal: true,
    is_highlight: true,
    calculation: "vh_za_obdobie",
  },
]

// ---- Helper functions ----

interface AccountTurnover {
  synteticky_ucet: string
  debit_total: number
  credit_total: number
}

async function fetchPeriodTurnovers(
  companyId: string,
  dateFrom: string,
  dateTo: string,
  supabase: SupabaseClient
): Promise<AccountTurnover[]> {
  const { data: lines, error } = await (supabase.from("journal_entry_lines") as any)
    .select(`
      account_id,
      debit_amount,
      credit_amount,
      journal_entry:journal_entries!inner(id, company_id, status, date)
    `)
    .eq("journal_entry.company_id", companyId)
    .eq("journal_entry.status", "posted")
    .gte("journal_entry.date", dateFrom)
    .lte("journal_entry.date", dateTo)

  if (error) {
    throw new Error(`Chyba pri nacitani uctu: ${error.message}`)
  }

  // Fetch accounts
  const { data: accounts, error: accError } = await (supabase.from("chart_of_accounts") as any)
    .select("id, synteticky_ucet")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (accError) {
    throw new Error(`Chyba pri nacitani uctov: ${accError.message}`)
  }

  const accountMap: Record<string, string> = {}
  for (const acc of (accounts || [])) {
    accountMap[acc.id] = acc.synteticky_ucet
  }

  // Aggregate by synteticky_ucet
  const turnoverMap: Record<string, { debit: number; credit: number }> = {}

  for (const line of (lines || [])) {
    const syn = accountMap[line.account_id]
    if (!syn) continue
    if (!turnoverMap[syn]) {
      turnoverMap[syn] = { debit: 0, credit: 0 }
    }
    turnoverMap[syn].debit += Number(line.debit_amount) || 0
    turnoverMap[syn].credit += Number(line.credit_amount) || 0
  }

  return Object.entries(turnoverMap).map(([synteticky_ucet, t]) => ({
    synteticky_ucet,
    debit_total: t.debit,
    credit_total: t.credit,
  }))
}

function getRevenue(turnovers: AccountTurnover[], codes: string[]): number {
  let total = 0
  for (const code of codes) {
    for (const t of turnovers) {
      if (t.synteticky_ucet === code || t.synteticky_ucet.startsWith(code)) {
        // Revenue accounts (class 6) have credit balance
        total += t.credit_total - t.debit_total
      }
    }
  }
  return total
}

function getExpense(turnovers: AccountTurnover[], codes: string[]): number {
  let total = 0
  for (const code of codes) {
    for (const t of turnovers) {
      if (t.synteticky_ucet === code || t.synteticky_ucet.startsWith(code)) {
        // Expense accounts (class 5) have debit balance
        total += t.debit_total - t.credit_total
      }
    }
  }
  return total
}

function processLine(
  def: PLLineDefinition,
  turnovers: AccountTurnover[],
  priorTurnovers: AccountTurnover[],
  rowValues: Map<number, { bezne: number; predchadzajuce: number }>
): ProfitLossLine {
  const children: ProfitLossLine[] = []

  if (def.children && def.children.length > 0) {
    for (const child of def.children) {
      children.push(processLine(child, turnovers, priorTurnovers, rowValues))
    }
  }

  let bezne = 0
  let predchadzajuce = 0

  if (def.is_subtotal && def.children && def.children.length > 0) {
    // Sum children
    for (const child of children) {
      bezne += child.bezne_obdobie
      predchadzajuce += child.predchadzajuce_obdobie
    }
  } else if (def.revenue_accounts.length > 0) {
    bezne = getRevenue(turnovers, def.revenue_accounts)
    predchadzajuce = getRevenue(priorTurnovers, def.revenue_accounts)
  } else if (def.expense_accounts.length > 0) {
    bezne = getExpense(turnovers, def.expense_accounts)
    predchadzajuce = getExpense(priorTurnovers, def.expense_accounts)
  }

  bezne = Math.round(bezne * 100) / 100
  predchadzajuce = Math.round(predchadzajuce * 100) / 100

  rowValues.set(def.riadok, { bezne, predchadzajuce })

  return {
    oznacenie: def.oznacenie,
    nazov: def.nazov,
    riadok: def.riadok,
    bezne_obdobie: bezne,
    predchadzajuce_obdobie: predchadzajuce,
    ucty: [...def.revenue_accounts, ...def.expense_accounts],
    children: children.length > 0 ? children : undefined,
    is_subtotal: def.is_subtotal,
    is_highlight: def.is_highlight,
  }
}

// ---- Main Export ----

export async function calculateProfitLoss(
  companyId: string,
  fiscalYearId: string,
  supabase: SupabaseClient,
  dateFrom?: string,
  dateTo?: string
): Promise<ProfitLossData> {
  // Fetch fiscal year info
  const { data: fiscalYear, error: fyError } = await (supabase.from("fiscal_years") as any)
    .select("id, year, start_date, end_date")
    .eq("id", fiscalYearId)
    .eq("company_id", companyId)
    .single() as { data: any; error: any }

  if (fyError || !fiscalYear) {
    throw new Error("Uctovne obdobie sa nenaslo")
  }

  const effectiveDateFrom = dateFrom || fiscalYear.start_date
  const effectiveDateTo = dateTo || fiscalYear.end_date

  // Fetch current period turnovers
  const currentTurnovers = await fetchPeriodTurnovers(companyId, effectiveDateFrom, effectiveDateTo, supabase)

  // Fetch prior period turnovers
  let priorTurnovers: AccountTurnover[] = []
  const priorYear = fiscalYear.year - 1
  const { data: priorFy } = await (supabase.from("fiscal_years") as any)
    .select("id, start_date, end_date")
    .eq("company_id", companyId)
    .eq("year", priorYear)
    .single() as { data: any; error: any }

  if (priorFy) {
    priorTurnovers = await fetchPeriodTurnovers(companyId, priorFy.start_date, priorFy.end_date, supabase)
  }

  // Process all lines
  const rowValues = new Map<number, { bezne: number; predchadzajuce: number }>()
  const lines: ProfitLossLine[] = []

  for (const def of PL_LINES) {
    if (def.calculation) {
      // Calculated line - process after we have row values
      lines.push({
        oznacenie: def.oznacenie,
        nazov: def.nazov,
        riadok: def.riadok,
        bezne_obdobie: 0, // placeholder
        predchadzajuce_obdobie: 0, // placeholder
        ucty: [],
        is_subtotal: def.is_subtotal,
        is_highlight: def.is_highlight,
      })
    } else {
      lines.push(processLine(def, currentTurnovers, priorTurnovers, rowValues))
    }
  }

  // Helper to get row value
  const rv = (riadok: number) => rowValues.get(riadok) || { bezne: 0, predchadzajuce: 0 }

  // Calculate Obchodna marza (r.1 - r.2)
  const obchodna_marza = {
    bezne: Math.round((rv(1).bezne - rv(2).bezne) * 100) / 100,
    predchadzajuce: Math.round((rv(1).predchadzajuce - rv(2).predchadzajuce) * 100) / 100,
  }
  rowValues.set(3, obchodna_marza)

  // Calculate Pridana hodnota (r.3 + r.4 - r.8)
  const pridana_hodnota = {
    bezne: Math.round((obchodna_marza.bezne + rv(4).bezne - rv(8).bezne) * 100) / 100,
    predchadzajuce: Math.round((obchodna_marza.predchadzajuce + rv(4).predchadzajuce - rv(8).predchadzajuce) * 100) / 100,
  }
  rowValues.set(11, pridana_hodnota)

  // VH z hospodarskej cinnosti
  // = pridana hodnota - C - D - E + III - F - G + IV - H + V - I
  const vh_hospodarska = {
    bezne: Math.round((pridana_hodnota.bezne - rv(12).bezne - rv(17).bezne - rv(18).bezne + rv(21).bezne - rv(24).bezne - rv(27).bezne + rv(28).bezne - rv(29).bezne + rv(30).bezne - rv(31).bezne) * 100) / 100,
    predchadzajuce: Math.round((pridana_hodnota.predchadzajuce - rv(12).predchadzajuce - rv(17).predchadzajuce - rv(18).predchadzajuce + rv(21).predchadzajuce - rv(24).predchadzajuce - rv(27).predchadzajuce + rv(28).predchadzajuce - rv(29).predchadzajuce + rv(30).predchadzajuce - rv(31).predchadzajuce) * 100) / 100,
  }
  rowValues.set(32, vh_hospodarska)

  // VH z financnej cinnosti
  // = VI - J + VII + VIII - K + IX - L + X - M + XI - N + XII - O + XIII - P
  const vh_financna = {
    bezne: Math.round((rv(33).bezne - rv(34).bezne + rv(35).bezne + rv(39).bezne - rv(40).bezne + rv(41).bezne - rv(42).bezne + rv(43).bezne - rv(44).bezne + rv(45).bezne - rv(46).bezne + rv(47).bezne - rv(48).bezne + rv(49).bezne - rv(50).bezne) * 100) / 100,
    predchadzajuce: Math.round((rv(33).predchadzajuce - rv(34).predchadzajuce + rv(35).predchadzajuce + rv(39).predchadzajuce - rv(40).predchadzajuce + rv(41).predchadzajuce - rv(42).predchadzajuce + rv(43).predchadzajuce - rv(44).predchadzajuce + rv(45).predchadzajuce - rv(46).predchadzajuce + rv(47).predchadzajuce - rv(48).predchadzajuce + rv(49).predchadzajuce - rv(50).predchadzajuce) * 100) / 100,
  }
  rowValues.set(51, vh_financna)

  // VH z beznej cinnosti pred zdanenim
  const vh_bezna_pred = {
    bezne: Math.round((vh_hospodarska.bezne + vh_financna.bezne) * 100) / 100,
    predchadzajuce: Math.round((vh_hospodarska.predchadzajuce + vh_financna.predchadzajuce) * 100) / 100,
  }
  rowValues.set(52, vh_bezna_pred)

  // VH z beznej cinnosti po zdaneni
  const vh_bezna_po = {
    bezne: Math.round((vh_bezna_pred.bezne - rv(53).bezne) * 100) / 100,
    predchadzajuce: Math.round((vh_bezna_pred.predchadzajuce - rv(53).predchadzajuce) * 100) / 100,
  }
  rowValues.set(56, vh_bezna_po)

  // VH z mimoriadnej cinnosti
  const vh_mimoriadna = {
    bezne: Math.round((rv(57).bezne - rv(58).bezne - rv(59).bezne) * 100) / 100,
    predchadzajuce: Math.round((rv(57).predchadzajuce - rv(58).predchadzajuce - rv(59).predchadzajuce) * 100) / 100,
  }
  rowValues.set(62, vh_mimoriadna)

  // VH za uctovne obdobie
  const vh_za_obdobie = {
    bezne: Math.round((vh_bezna_po.bezne + vh_mimoriadna.bezne - rv(63).bezne) * 100) / 100,
    predchadzajuce: Math.round((vh_bezna_po.predchadzajuce + vh_mimoriadna.predchadzajuce - rv(63).predchadzajuce) * 100) / 100,
  }
  rowValues.set(64, vh_za_obdobie)

  // Update calculated rows in lines array
  for (const line of lines) {
    const val = rowValues.get(line.riadok)
    if (val && line.is_subtotal && (line.bezne_obdobie === 0 && line.predchadzajuce_obdobie === 0)) {
      line.bezne_obdobie = val.bezne
      line.predchadzajuce_obdobie = val.predchadzajuce
    }
  }

  return {
    lines,
    obchodna_marza: obchodna_marza,
    pridana_hodnota: pridana_hodnota,
    vh_hospodarska: vh_hospodarska,
    vh_financna: vh_financna,
    vh_bezna_cinnost: vh_bezna_pred,
    vh_mimoriadna: vh_mimoriadna,
    vh_za_obdobie: vh_za_obdobie,
    vh_po_zdaneni: vh_bezna_po,
    fiscal_year: `${fiscalYear.year}`,
    date_from: effectiveDateFrom,
    date_to: effectiveDateTo,
    generated_at: new Date().toISOString(),
  }
}

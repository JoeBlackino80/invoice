/**
 * Balance Sheet Calculator (Suvaha) per Slovak accounting standard Uc 1-01
 *
 * Structure:
 * AKTIVA (Assets) - A. Neobezny majetok, B. Obezny majetok, C. Casove rozlisenie
 * PASIVA (Liabilities & Equity) - A. Vlastne imanie, B. Zavazky, C. Casove rozlisenie
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ---- Types ----

export interface BalanceSheetLine {
  oznacenie: string
  nazov: string
  riadok: number
  brutto: number
  korekcia: number
  netto: number
  predchadzajuce_obdobie: number
  ucty: string[]
  children?: BalanceSheetLine[]
  is_subtotal?: boolean
}

export interface BalanceSheetData {
  aktiva: BalanceSheetLine[]
  pasiva: BalanceSheetLine[]
  aktiva_spolu: {
    brutto: number
    korekcia: number
    netto: number
    predchadzajuce_obdobie: number
  }
  pasiva_spolu: {
    netto: number
    predchadzajuce_obdobie: number
  }
  fiscal_year: string
  date_to: string
  generated_at: string
}

// ---- Balance sheet structure definitions per Uc 1-01 ----

interface LineDefinition {
  oznacenie: string
  nazov: string
  riadok: number
  account_ranges: string[]
  korekcia_ranges?: string[]
  children?: LineDefinition[]
  is_subtotal?: boolean
  sum_of?: number[]
}

const AKTIVA_DEFINITION: LineDefinition[] = [
  {
    oznacenie: "A.",
    nazov: "Neobezny majetok",
    riadok: 3,
    account_ranges: [],
    is_subtotal: true,
    sum_of: [4, 13, 23],
    children: [
      {
        oznacenie: "A.I.",
        nazov: "Dlhodoby nehmotny majetok",
        riadok: 4,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [5, 6, 7, 8, 9, 10, 11, 12],
        children: [
          { oznacenie: "A.I.1.", nazov: "Aktivovane naklady na vyvoj", riadok: 5, account_ranges: ["012"], korekcia_ranges: ["072", "091"] },
          { oznacenie: "A.I.2.", nazov: "Software", riadok: 6, account_ranges: ["013"], korekcia_ranges: ["073", "091"] },
          { oznacenie: "A.I.3.", nazov: "Ocenitelne prava", riadok: 7, account_ranges: ["014"], korekcia_ranges: ["074", "091"] },
          { oznacenie: "A.I.4.", nazov: "Goodwill", riadok: 8, account_ranges: ["015"], korekcia_ranges: ["075", "091"] },
          { oznacenie: "A.I.5.", nazov: "Ostatny dlhodoby nehmotny majetok", riadok: 9, account_ranges: ["019"], korekcia_ranges: ["079", "091"] },
          { oznacenie: "A.I.6.", nazov: "Obstaravany dlhodoby nehmotny majetok", riadok: 10, account_ranges: ["041"], korekcia_ranges: ["093"] },
          { oznacenie: "A.I.7.", nazov: "Poskytnute preddavky na DNM", riadok: 11, account_ranges: ["051"], korekcia_ranges: ["095"] },
          { oznacenie: "A.I.8.", nazov: "Dlhodoby nehmotny majetok - opravna polozka", riadok: 12, account_ranges: [], korekcia_ranges: [] },
        ],
      },
      {
        oznacenie: "A.II.",
        nazov: "Dlhodoby hmotny majetok",
        riadok: 13,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [14, 15, 16, 17, 18, 19, 20, 21, 22],
        children: [
          { oznacenie: "A.II.1.", nazov: "Pozemky", riadok: 14, account_ranges: ["031"], korekcia_ranges: ["092"] },
          { oznacenie: "A.II.2.", nazov: "Stavby", riadok: 15, account_ranges: ["021"], korekcia_ranges: ["081", "092"] },
          { oznacenie: "A.II.3.", nazov: "Samostatne hnutelne veci a subory hnutelnych veci", riadok: 16, account_ranges: ["022"], korekcia_ranges: ["082", "092"] },
          { oznacenie: "A.II.4.", nazov: "Pestovatelske celky trvalych porastov", riadok: 17, account_ranges: ["025"], korekcia_ranges: ["085", "092"] },
          { oznacenie: "A.II.5.", nazov: "Zakladne stado a tazne zvierata", riadok: 18, account_ranges: ["026"], korekcia_ranges: ["086", "092"] },
          { oznacenie: "A.II.6.", nazov: "Ostatny dlhodoby hmotny majetok", riadok: 19, account_ranges: ["029", "032"], korekcia_ranges: ["089", "092"] },
          { oznacenie: "A.II.7.", nazov: "Obstaravany dlhodoby hmotny majetok", riadok: 20, account_ranges: ["042"], korekcia_ranges: ["094"] },
          { oznacenie: "A.II.8.", nazov: "Poskytnute preddavky na DHM", riadok: 21, account_ranges: ["052"], korekcia_ranges: ["095"] },
          { oznacenie: "A.II.9.", nazov: "Opravna polozka k nadobudnutemu majetku", riadok: 22, account_ranges: ["097"], korekcia_ranges: [] },
        ],
      },
      {
        oznacenie: "A.III.",
        nazov: "Dlhodoby financny majetok",
        riadok: 23,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [24, 25, 26, 27, 28, 29, 30],
        children: [
          { oznacenie: "A.III.1.", nazov: "Podielove cenné papiere a podiely v dcerskej uctovnej jednotke", riadok: 24, account_ranges: ["061"], korekcia_ranges: ["096"] },
          { oznacenie: "A.III.2.", nazov: "Podielove cenné papiere a podiely v spolocnosti s podstatnym vplyvom", riadok: 25, account_ranges: ["062"], korekcia_ranges: ["096"] },
          { oznacenie: "A.III.3.", nazov: "Ostatne dlhodobe cenné papiere a podiely", riadok: 26, account_ranges: ["063"], korekcia_ranges: ["096"] },
          { oznacenie: "A.III.4.", nazov: "Pozicky uctovnej jednotke v konsolidovanom celku", riadok: 27, account_ranges: ["066"], korekcia_ranges: ["096"] },
          { oznacenie: "A.III.5.", nazov: "Ostatny dlhodoby financny majetok", riadok: 28, account_ranges: ["065", "067", "069"], korekcia_ranges: ["096"] },
          { oznacenie: "A.III.6.", nazov: "Pozicky s dobou splatnosti najviac jeden rok", riadok: 29, account_ranges: ["066"], korekcia_ranges: ["096"] },
          { oznacenie: "A.III.7.", nazov: "Obstaravany dlhodoby financny majetok", riadok: 30, account_ranges: ["043"], korekcia_ranges: ["096"] },
        ],
      },
    ],
  },
  {
    oznacenie: "B.",
    nazov: "Obezny majetok",
    riadok: 31,
    account_ranges: [],
    is_subtotal: true,
    sum_of: [32, 39, 48, 55],
    children: [
      {
        oznacenie: "B.I.",
        nazov: "Zasoby",
        riadok: 32,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [33, 34, 35, 36, 37, 38],
        children: [
          { oznacenie: "B.I.1.", nazov: "Material", riadok: 33, account_ranges: ["112"], korekcia_ranges: ["191"] },
          { oznacenie: "B.I.2.", nazov: "Nedokoncena vyroba a polotovary vlastnej vyroby", riadok: 34, account_ranges: ["121", "122"], korekcia_ranges: ["192"] },
          { oznacenie: "B.I.3.", nazov: "Vyrobky", riadok: 35, account_ranges: ["123"], korekcia_ranges: ["193"] },
          { oznacenie: "B.I.4.", nazov: "Zvierata", riadok: 36, account_ranges: ["124"], korekcia_ranges: ["194"] },
          { oznacenie: "B.I.5.", nazov: "Tovar", riadok: 37, account_ranges: ["132"], korekcia_ranges: ["196"] },
          { oznacenie: "B.I.6.", nazov: "Poskytnute preddavky na zasoby", riadok: 38, account_ranges: ["314"], korekcia_ranges: ["391"] },
        ],
      },
      {
        oznacenie: "B.II.",
        nazov: "Dlhodobe pohladavky",
        riadok: 39,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [40, 41, 42, 43, 44, 45, 46, 47],
        children: [
          { oznacenie: "B.II.1.", nazov: "Pohladavky z obchodneho styku", riadok: 40, account_ranges: ["311"], korekcia_ranges: ["391"] },
          { oznacenie: "B.II.2.", nazov: "Cistá hodnota zakazky", riadok: 41, account_ranges: ["316"], korekcia_ranges: [] },
          { oznacenie: "B.II.3.", nazov: "Ostatne pohladavky voci priaznenim osobam", riadok: 42, account_ranges: ["351"], korekcia_ranges: ["391"] },
          { oznacenie: "B.II.4.", nazov: "Pohladavky voci spolocnikom", riadok: 43, account_ranges: ["354", "355"], korekcia_ranges: ["391"] },
          { oznacenie: "B.II.5.", nazov: "Pohladavky voci zamestnancom", riadok: 44, account_ranges: ["335"], korekcia_ranges: [] },
          { oznacenie: "B.II.6.", nazov: "Pohladavky voci instituciam sociálneho poistenia", riadok: 45, account_ranges: ["336"], korekcia_ranges: [] },
          { oznacenie: "B.II.7.", nazov: "Danove pohladavky a dotacie", riadok: 46, account_ranges: ["341", "342", "343", "345", "346"], korekcia_ranges: [] },
          { oznacenie: "B.II.8.", nazov: "Ine pohladavky", riadok: 47, account_ranges: ["315", "378"], korekcia_ranges: ["391"] },
        ],
      },
      {
        oznacenie: "B.III.",
        nazov: "Kratkodobe pohladavky",
        riadok: 48,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [49, 50, 51, 52, 53, 54],
        children: [
          { oznacenie: "B.III.1.", nazov: "Pohladavky z obchodneho styku", riadok: 49, account_ranges: ["311"], korekcia_ranges: ["391"] },
          { oznacenie: "B.III.2.", nazov: "Cistá hodnota zakazky", riadok: 50, account_ranges: ["316"], korekcia_ranges: [] },
          { oznacenie: "B.III.3.", nazov: "Danove pohladavky a dotacie", riadok: 51, account_ranges: ["341", "342", "343", "345", "346"], korekcia_ranges: [] },
          { oznacenie: "B.III.4.", nazov: "Pohladavky voci spolocnikom a združeniu", riadok: 52, account_ranges: ["354", "355", "358"], korekcia_ranges: ["391"] },
          { oznacenie: "B.III.5.", nazov: "Socialne poistenie", riadok: 53, account_ranges: ["336"], korekcia_ranges: [] },
          { oznacenie: "B.III.6.", nazov: "Ine pohladavky", riadok: 54, account_ranges: ["315", "335", "378", "398"], korekcia_ranges: ["391"] },
        ],
      },
      {
        oznacenie: "B.IV.",
        nazov: "Financne ucty",
        riadok: 55,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [56, 57, 58, 59],
        children: [
          { oznacenie: "B.IV.1.", nazov: "Peniaze", riadok: 56, account_ranges: ["211"], korekcia_ranges: [] },
          { oznacenie: "B.IV.2.", nazov: "Ucty v bankach", riadok: 57, account_ranges: ["221"], korekcia_ranges: ["291"] },
          { oznacenie: "B.IV.3.", nazov: "Kratkodoby financny majetok", riadok: 58, account_ranges: ["251", "253", "256"], korekcia_ranges: ["291"] },
          { oznacenie: "B.IV.4.", nazov: "Obstaravany kratkodoby financny majetok", riadok: 59, account_ranges: ["259"], korekcia_ranges: ["291"] },
        ],
      },
    ],
  },
  {
    oznacenie: "C.",
    nazov: "Casove rozlisenie",
    riadok: 60,
    account_ranges: [],
    is_subtotal: true,
    sum_of: [61, 62, 63],
    children: [
      { oznacenie: "C.1.", nazov: "Naklady buducich obdobi", riadok: 61, account_ranges: ["381"], korekcia_ranges: [] },
      { oznacenie: "C.2.", nazov: "Komplexne naklady buducich obdobi", riadok: 62, account_ranges: ["382"], korekcia_ranges: [] },
      { oznacenie: "C.3.", nazov: "Prijmy buducich obdobi", riadok: 63, account_ranges: ["385"], korekcia_ranges: [] },
    ],
  },
]

const PASIVA_DEFINITION: LineDefinition[] = [
  {
    oznacenie: "A.",
    nazov: "Vlastne imanie",
    riadok: 66,
    account_ranges: [],
    is_subtotal: true,
    sum_of: [67, 71, 78, 81, 84],
    children: [
      {
        oznacenie: "A.I.",
        nazov: "Zakladne imanie",
        riadok: 67,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [68, 69, 70],
        children: [
          { oznacenie: "A.I.1.", nazov: "Zakladne imanie", riadok: 68, account_ranges: ["411"], korekcia_ranges: [] },
          { oznacenie: "A.I.2.", nazov: "Vlastne akcie a vlastne obchodne podiely", riadok: 69, account_ranges: ["252"], korekcia_ranges: [] },
          { oznacenie: "A.I.3.", nazov: "Zmena zakladneho imania", riadok: 70, account_ranges: ["419"], korekcia_ranges: [] },
        ],
      },
      {
        oznacenie: "A.II.",
        nazov: "Kapitálove fondy",
        riadok: 71,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [72, 73, 74, 75, 76, 77],
        children: [
          { oznacenie: "A.II.1.", nazov: "Emisne azio", riadok: 72, account_ranges: ["412"], korekcia_ranges: [] },
          { oznacenie: "A.II.2.", nazov: "Ostatne kapitalove fondy", riadok: 73, account_ranges: ["413"], korekcia_ranges: [] },
          { oznacenie: "A.II.3.", nazov: "Zakonny rezervny fond (Nedelitelny fond) z kapitalovych vkladov", riadok: 74, account_ranges: ["417"], korekcia_ranges: [] },
          { oznacenie: "A.II.4.", nazov: "Ocenovacie rozdiely z precenenia majetku a zavazkov", riadok: 75, account_ranges: ["414"], korekcia_ranges: [] },
          { oznacenie: "A.II.5.", nazov: "Ocenovacie rozdiely z kapitalovych ucastin", riadok: 76, account_ranges: ["415"], korekcia_ranges: [] },
          { oznacenie: "A.II.6.", nazov: "Ocenovacie rozdiely z precenenia pri zluceni, splynutí a rozdeleni", riadok: 77, account_ranges: ["416"], korekcia_ranges: [] },
        ],
      },
      {
        oznacenie: "A.III.",
        nazov: "Fondy zo zisku",
        riadok: 78,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [79, 80],
        children: [
          { oznacenie: "A.III.1.", nazov: "Zakonny rezervny fond / Nedelitelny fond", riadok: 79, account_ranges: ["421"], korekcia_ranges: [] },
          { oznacenie: "A.III.2.", nazov: "Ostatne fondy", riadok: 80, account_ranges: ["422", "423", "427"], korekcia_ranges: [] },
        ],
      },
      {
        oznacenie: "A.IV.",
        nazov: "Vysledok hospodarenia minulych rokov",
        riadok: 81,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [82, 83],
        children: [
          { oznacenie: "A.IV.1.", nazov: "Nerozdeleny zisk minulych rokov", riadok: 82, account_ranges: ["428"], korekcia_ranges: [] },
          { oznacenie: "A.IV.2.", nazov: "Neuhradena strata minulych rokov", riadok: 83, account_ranges: ["429"], korekcia_ranges: [] },
        ],
      },
      {
        oznacenie: "A.V.",
        nazov: "Vysledok hospodarenia za uctovne obdobie (+/-)",
        riadok: 84,
        account_ranges: ["431"],
        is_subtotal: false,
        korekcia_ranges: [],
      },
    ],
  },
  {
    oznacenie: "B.",
    nazov: "Zavazky",
    riadok: 85,
    account_ranges: [],
    is_subtotal: true,
    sum_of: [86, 91, 102, 114],
    children: [
      {
        oznacenie: "B.I.",
        nazov: "Rezervy",
        riadok: 86,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [87, 88, 89, 90],
        children: [
          { oznacenie: "B.I.1.", nazov: "Rezervy zakonné dlhodobe", riadok: 87, account_ranges: ["451"], korekcia_ranges: [] },
          { oznacenie: "B.I.2.", nazov: "Rezervy zakonné kratkodobe", riadok: 88, account_ranges: ["323", "451"], korekcia_ranges: [] },
          { oznacenie: "B.I.3.", nazov: "Ostatne dlhodobe rezervy", riadok: 89, account_ranges: ["459"], korekcia_ranges: [] },
          { oznacenie: "B.I.4.", nazov: "Ostatne krattkodobe rezervy", riadok: 90, account_ranges: ["323", "459"], korekcia_ranges: [] },
        ],
      },
      {
        oznacenie: "B.II.",
        nazov: "Dlhodobe zavazky",
        riadok: 91,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [92, 93, 94, 95, 96, 97, 98, 99, 100, 101],
        children: [
          { oznacenie: "B.II.1.", nazov: "Dlhodobe zavazky z obchodneho styku", riadok: 92, account_ranges: ["479"], korekcia_ranges: [] },
          { oznacenie: "B.II.2.", nazov: "Cistá hodnota zakazky", riadok: 93, account_ranges: ["316"], korekcia_ranges: [] },
          { oznacenie: "B.II.3.", nazov: "Ostatne zavazky voci priaznenim osobam", riadok: 94, account_ranges: ["471"], korekcia_ranges: [] },
          { oznacenie: "B.II.4.", nazov: "Ostatne dlhodobe zavazky", riadok: 95, account_ranges: ["472", "474", "475", "478", "479"], korekcia_ranges: [] },
          { oznacenie: "B.II.5.", nazov: "Dlhodobe prijate preddavky", riadok: 96, account_ranges: ["475"], korekcia_ranges: [] },
          { oznacenie: "B.II.6.", nazov: "Dlhodobe zmenky na uhradu", riadok: 97, account_ranges: ["478"], korekcia_ranges: [] },
          { oznacenie: "B.II.7.", nazov: "Vydane dlhopisy", riadok: 98, account_ranges: ["473"], korekcia_ranges: [] },
          { oznacenie: "B.II.8.", nazov: "Socialny fond", riadok: 99, account_ranges: ["472"], korekcia_ranges: [] },
          { oznacenie: "B.II.9.", nazov: "Ostatne dlhodobe zavazky", riadok: 100, account_ranges: ["479"], korekcia_ranges: [] },
          { oznacenie: "B.II.10.", nazov: "Odlozeny danovy zavazok", riadok: 101, account_ranges: ["481"], korekcia_ranges: [] },
        ],
      },
      {
        oznacenie: "B.III.",
        nazov: "Kratkodobe zavazky",
        riadok: 102,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113],
        children: [
          { oznacenie: "B.III.1.", nazov: "Zavazky z obchodneho styku", riadok: 103, account_ranges: ["321", "322"], korekcia_ranges: [] },
          { oznacenie: "B.III.2.", nazov: "Cistá hodnota zakazky", riadok: 104, account_ranges: ["316"], korekcia_ranges: [] },
          { oznacenie: "B.III.3.", nazov: "Ostatne zavazky voci priaznenim osobam", riadok: 105, account_ranges: ["361"], korekcia_ranges: [] },
          { oznacenie: "B.III.4.", nazov: "Zavazky voci spolocnikom a združeniu", riadok: 106, account_ranges: ["364", "365", "366", "367"], korekcia_ranges: [] },
          { oznacenie: "B.III.5.", nazov: "Zavazky voci zamestnancom", riadok: 107, account_ranges: ["331", "333"], korekcia_ranges: [] },
          { oznacenie: "B.III.6.", nazov: "Zavazky zo sociálneho poistenia", riadok: 108, account_ranges: ["336"], korekcia_ranges: [] },
          { oznacenie: "B.III.7.", nazov: "Danove zavazky a dotacie", riadok: 109, account_ranges: ["341", "342", "343", "345", "346", "347"], korekcia_ranges: [] },
          { oznacenie: "B.III.8.", nazov: "Zavazky z derivatovych operacii", riadok: 110, account_ranges: ["373"], korekcia_ranges: [] },
          { oznacenie: "B.III.9.", nazov: "Ine zavazky", riadok: 111, account_ranges: ["325", "326", "379", "398"], korekcia_ranges: [] },
          { oznacenie: "B.III.10.", nazov: "Kratkodobe financne vypomoci", riadok: 112, account_ranges: ["241", "249"], korekcia_ranges: [] },
          { oznacenie: "B.III.11.", nazov: "Bankove uvery", riadok: 113, account_ranges: ["231", "232", "461"], korekcia_ranges: [] },
        ],
      },
      {
        oznacenie: "B.IV.",
        nazov: "Bankove uvery",
        riadok: 114,
        account_ranges: [],
        is_subtotal: true,
        sum_of: [115, 116],
        children: [
          { oznacenie: "B.IV.1.", nazov: "Bankove uvery dlhodobe", riadok: 115, account_ranges: ["461"], korekcia_ranges: [] },
          { oznacenie: "B.IV.2.", nazov: "Kratkodobe bankove uvery", riadok: 116, account_ranges: ["231", "232"], korekcia_ranges: [] },
        ],
      },
    ],
  },
  {
    oznacenie: "C.",
    nazov: "Casove rozlisenie",
    riadok: 117,
    account_ranges: [],
    is_subtotal: true,
    sum_of: [118, 119],
    children: [
      { oznacenie: "C.1.", nazov: "Vynosy buducich obdobi", riadok: 118, account_ranges: ["384"], korekcia_ranges: [] },
      { oznacenie: "C.2.", nazov: "Vydavky buducich obdobi", riadok: 119, account_ranges: ["383"], korekcia_ranges: [] },
    ],
  },
]

// ---- Helper Functions ----

interface AccountBalance {
  synteticky_ucet: string
  debit_total: number
  credit_total: number
}

async function fetchAccountBalances(
  companyId: string,
  dateTo: string,
  supabase: SupabaseClient
): Promise<AccountBalance[]> {
  // Fetch all posted journal entry lines up to date_to
  const { data: lines, error } = await (supabase.from("journal_entry_lines") as any)
    .select(`
      account_id,
      debit_amount,
      credit_amount,
      journal_entry:journal_entries!inner(id, company_id, status, date)
    `)
    .eq("journal_entry.company_id", companyId)
    .eq("journal_entry.status", "posted")
    .lte("journal_entry.date", dateTo)

  if (error) {
    throw new Error(`Chyba pri nacitani uctu: ${error.message}`)
  }

  // Fetch accounts to map IDs to synteticky_ucet
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
  const balanceMap: Record<string, { debit: number; credit: number }> = {}

  for (const line of (lines || [])) {
    const syn = accountMap[line.account_id]
    if (!syn) continue
    if (!balanceMap[syn]) {
      balanceMap[syn] = { debit: 0, credit: 0 }
    }
    balanceMap[syn].debit += Number(line.debit_amount) || 0
    balanceMap[syn].credit += Number(line.credit_amount) || 0
  }

  return Object.entries(balanceMap).map(([synteticky_ucet, bal]) => ({
    synteticky_ucet,
    debit_total: bal.debit,
    credit_total: bal.credit,
  }))
}

function getAccountBalance(
  balances: AccountBalance[],
  accountCodes: string[],
  side: "debit" | "credit" | "net_debit" | "net_credit"
): number {
  let total = 0
  for (const code of accountCodes) {
    for (const bal of balances) {
      if (bal.synteticky_ucet === code || bal.synteticky_ucet.startsWith(code)) {
        if (side === "debit") {
          total += bal.debit_total
        } else if (side === "credit") {
          total += bal.credit_total
        } else if (side === "net_debit") {
          total += bal.debit_total - bal.credit_total
        } else {
          total += bal.credit_total - bal.debit_total
        }
      }
    }
  }
  return total
}

function processDefinition(
  def: LineDefinition,
  balances: AccountBalance[],
  priorBalances: AccountBalance[],
  isAktiva: boolean
): BalanceSheetLine {
  const children: BalanceSheetLine[] = []

  if (def.children && def.children.length > 0) {
    for (const child of def.children) {
      children.push(processDefinition(child, balances, priorBalances, isAktiva))
    }
  }

  let brutto = 0
  let korekcia = 0
  let priorNetto = 0

  if (def.is_subtotal && def.sum_of && def.sum_of.length > 0) {
    // Sum from children by riadok
    const childMap = new Map<number, BalanceSheetLine>()
    const collectChildren = (items: BalanceSheetLine[]) => {
      for (const item of items) {
        childMap.set(item.riadok, item)
        if (item.children) {
          collectChildren(item.children)
        }
      }
    }
    collectChildren(children)

    for (const rowNum of def.sum_of) {
      const childLine = childMap.get(rowNum)
      if (childLine) {
        brutto += childLine.brutto
        korekcia += childLine.korekcia
        priorNetto += childLine.predchadzajuce_obdobie
      }
    }
  } else if (def.account_ranges.length > 0) {
    if (isAktiva) {
      // Aktiva: brutto = debit balance
      brutto = getAccountBalance(balances, def.account_ranges, "net_debit")
      // Korekcia: accumulated depreciation / impairment (credit balance of correction accounts)
      if (def.korekcia_ranges && def.korekcia_ranges.length > 0) {
        korekcia = getAccountBalance(balances, def.korekcia_ranges, "net_credit")
      }
      priorNetto = getAccountBalance(priorBalances, def.account_ranges, "net_debit")
      if (def.korekcia_ranges && def.korekcia_ranges.length > 0) {
        priorNetto -= getAccountBalance(priorBalances, def.korekcia_ranges, "net_credit")
      }
    } else {
      // Pasiva: credit balance
      brutto = getAccountBalance(balances, def.account_ranges, "net_credit")
      priorNetto = getAccountBalance(priorBalances, def.account_ranges, "net_credit")
    }
  }

  const netto = brutto - korekcia

  return {
    oznacenie: def.oznacenie,
    nazov: def.nazov,
    riadok: def.riadok,
    brutto: Math.round(brutto * 100) / 100,
    korekcia: Math.round(korekcia * 100) / 100,
    netto: Math.round(netto * 100) / 100,
    predchadzajuce_obdobie: Math.round(priorNetto * 100) / 100,
    ucty: def.account_ranges,
    children: children.length > 0 ? children : undefined,
    is_subtotal: def.is_subtotal,
  }
}

// ---- Main Export ----

export async function calculateBalanceSheet(
  companyId: string,
  fiscalYearId: string,
  supabase: SupabaseClient,
  dateTo?: string
): Promise<BalanceSheetData> {
  // Fetch fiscal year info
  const { data: fiscalYear, error: fyError } = await (supabase.from("fiscal_years") as any)
    .select("id, year, start_date, end_date")
    .eq("id", fiscalYearId)
    .eq("company_id", companyId)
    .single() as { data: any; error: any }

  if (fyError || !fiscalYear) {
    throw new Error("Uctovne obdobie sa nenaslo")
  }

  const effectiveDateTo = dateTo || fiscalYear.end_date

  // Fetch current period balances
  const currentBalances = await fetchAccountBalances(companyId, effectiveDateTo, supabase)

  // Fetch prior period balances (previous fiscal year end)
  let priorBalances: AccountBalance[] = []
  const priorYear = fiscalYear.year - 1
  const { data: priorFy } = await (supabase.from("fiscal_years") as any)
    .select("id, end_date")
    .eq("company_id", companyId)
    .eq("year", priorYear)
    .single() as { data: any; error: any }

  if (priorFy) {
    priorBalances = await fetchAccountBalances(companyId, priorFy.end_date, supabase)
  }

  // Process AKTIVA
  const aktiva: BalanceSheetLine[] = []
  for (const def of AKTIVA_DEFINITION) {
    aktiva.push(processDefinition(def, currentBalances, priorBalances, true))
  }

  // Process PASIVA
  const pasiva: BalanceSheetLine[] = []
  for (const def of PASIVA_DEFINITION) {
    pasiva.push(processDefinition(def, currentBalances, priorBalances, false))
  }

  // Calculate totals
  const aktiva_spolu = {
    brutto: aktiva.reduce((sum, a) => sum + a.brutto, 0),
    korekcia: aktiva.reduce((sum, a) => sum + a.korekcia, 0),
    netto: aktiva.reduce((sum, a) => sum + a.netto, 0),
    predchadzajuce_obdobie: aktiva.reduce((sum, a) => sum + a.predchadzajuce_obdobie, 0),
  }

  const pasiva_spolu = {
    netto: pasiva.reduce((sum, p) => sum + p.netto, 0),
    predchadzajuce_obdobie: pasiva.reduce((sum, p) => sum + p.predchadzajuce_obdobie, 0),
  }

  return {
    aktiva,
    pasiva,
    aktiva_spolu: {
      brutto: Math.round(aktiva_spolu.brutto * 100) / 100,
      korekcia: Math.round(aktiva_spolu.korekcia * 100) / 100,
      netto: Math.round(aktiva_spolu.netto * 100) / 100,
      predchadzajuce_obdobie: Math.round(aktiva_spolu.predchadzajuce_obdobie * 100) / 100,
    },
    pasiva_spolu: {
      netto: Math.round(pasiva_spolu.netto * 100) / 100,
      predchadzajuce_obdobie: Math.round(pasiva_spolu.predchadzajuce_obdobie * 100) / 100,
    },
    fiscal_year: `${fiscalYear.year}`,
    date_to: effectiveDateTo,
    generated_at: new Date().toISOString(),
  }
}

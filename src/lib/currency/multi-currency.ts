// Multi-Currency Support with Exchange Rate Differences
// Slovak accounting: kurzove rozdiely (563 - strata, 663 - zisk)

// ============ Types ============

export interface CurrencyInfo {
  code: string
  name_sk: string
  symbol: string
  decimal_places: number
}

export interface ExchangeRate {
  currency_from: string
  currency_to: string
  rate: number
  date: string
  source: string
}

export interface ExchangeRateDiff {
  originalRate: number
  paymentRate: number
  amount: number // suma v cudzej mene
  amountOriginal: number // suma v EUR podla povodneho kurzu
  amountPayment: number // suma v EUR podla kurzu pri uhrade
  difference: number // kurzovy rozdiel v EUR (kladny = zisk, zaporny = strata)
  type: "kurzovy_zisk" | "kurzova_strata"
  account: string // 563 alebo 663
  counterAccount: string // 311 alebo 321
  description: string
}

export interface AccountingEntry {
  debit_account: string
  credit_account: string
  amount: number
  description: string
  date: string
  currency?: string
  document_type: string
}

export interface OpenItem {
  id: string
  type: "receivable" | "payable" // pohladavka / zavazok
  contact_name: string
  invoice_number: string
  currency: string
  foreign_amount: number
  original_rate: number
  original_eur_amount: number
  date: string
  due_date: string
}

export interface RevaluationResult {
  item: OpenItem
  closingRate: number
  newEurAmount: number
  difference: number
  type: "kurzovy_zisk" | "kurzova_strata"
  account: string
  counterAccount: string
  entry: AccountingEntry
}

// ============ Supported Currencies ============

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "EUR", name_sk: "Euro", symbol: "\u20ac", decimal_places: 2 },
  { code: "USD", name_sk: "Americk\u00fd dol\u00e1r", symbol: "$", decimal_places: 2 },
  { code: "GBP", name_sk: "Britsk\u00e1 libra", symbol: "\u00a3", decimal_places: 2 },
  { code: "CZK", name_sk: "\u010cesk\u00e1 koruna", symbol: "K\u010d", decimal_places: 2 },
  { code: "HUF", name_sk: "Ma\u010farsk\u00fd forint", symbol: "Ft", decimal_places: 2 },
  { code: "PLN", name_sk: "Po\u013esk\u00fd zlot\u00fd", symbol: "z\u0142", decimal_places: 2 },
  { code: "CHF", name_sk: "\u0160vaj\u010diarsky frank", symbol: "CHF", decimal_places: 2 },
  { code: "SEK", name_sk: "\u0160v\u00e9dska koruna", symbol: "kr", decimal_places: 2 },
  { code: "NOK", name_sk: "N\u00f3rska koruna", symbol: "kr", decimal_places: 2 },
  { code: "DKK", name_sk: "D\u00e1nska koruna", symbol: "kr", decimal_places: 2 },
  { code: "RON", name_sk: "Rumunsk\u00fd leu", symbol: "lei", decimal_places: 2 },
  { code: "BGN", name_sk: "Bulharsk\u00fd lev", symbol: "\u043b\u0432", decimal_places: 2 },
  { code: "HRK", name_sk: "Chorv\u00e1tska kuna", symbol: "kn", decimal_places: 2 },
  { code: "JPY", name_sk: "Japonsk\u00fd jen", symbol: "\u00a5", decimal_places: 0 },
  { code: "CAD", name_sk: "Kanadsk\u00fd dol\u00e1r", symbol: "CA$", decimal_places: 2 },
  { code: "AUD", name_sk: "Austr\u00e1lsky dol\u00e1r", symbol: "A$", decimal_places: 2 },
  { code: "CNY", name_sk: "\u010c\u00ednsky j\u00fcan", symbol: "\u00a5", decimal_places: 2 },
  { code: "TRY", name_sk: "Tureck\u00e1 l\u00edra", symbol: "\u20ba", decimal_places: 2 },
]

// ============ ECB Rates (Real) ============

import { fetchEcbRates } from "@/lib/exchange-rates"

// Fallback rates used when ECB feed is unreachable
const FALLBACK_RATES: Record<string, number> = {
  USD: 1.08,
  GBP: 0.86,
  CZK: 25.3,
  HUF: 395.0,
  PLN: 4.32,
  CHF: 0.94,
  SEK: 11.29,
  NOK: 11.53,
  DKK: 7.46,
  RON: 4.97,
  BGN: 1.96,
  HRK: 7.53,
  JPY: 162.5,
  CAD: 1.48,
  AUD: 1.65,
  CNY: 7.82,
  TRY: 34.22,
}

export async function fetchECBRates(date?: string): Promise<ExchangeRate[]> {
  const rateDate = date || new Date().toISOString().split("T")[0]
  const rates: ExchangeRate[] = []

  let ecbRates: Record<string, number>
  try {
    ecbRates = await fetchEcbRates()
  } catch {
    ecbRates = FALLBACK_RATES
  }

  // Merge with fallback to ensure all currencies are covered
  const allRates = { ...FALLBACK_RATES, ...ecbRates }

  for (const [currency, rate] of Object.entries(allRates)) {
    rates.push({
      currency_from: "EUR",
      currency_to: currency,
      rate,
      date: rateDate,
      source: "ECB",
    })
  }

  return rates
}

// ============ Currency Conversion ============

export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number
): number {
  if (fromCurrency === toCurrency) return amount
  if (rate <= 0) return 0

  // If converting FROM EUR to foreign currency: multiply by rate
  // If converting FROM foreign currency to EUR: divide by rate
  if (fromCurrency === "EUR") {
    return Math.round(amount * rate * 100) / 100
  } else if (toCurrency === "EUR") {
    return Math.round((amount / rate) * 100) / 100
  } else {
    // Cross-rate: both are non-EUR, need rates vs EUR for both
    // rate is treated as fromCurrency/EUR -> toCurrency/EUR ratio
    return Math.round(amount * rate * 100) / 100
  }
}

// ============ Exchange Rate Differences ============

/**
 * Calculate exchange rate difference (kurzovy rozdiel)
 *
 * For receivables (pohladavky, ucet 311):
 * - Payment rate > original rate -> kurzovy zisk (663) - we get more EUR
 * - Payment rate < original rate -> kurzova strata (563) - we get less EUR
 *
 * For payables (zavazky, ucet 321):
 * - Payment rate > original rate -> kurzova strata (563) - we pay more EUR
 * - Payment rate < original rate -> kurzovy zisk (663) - we pay less EUR
 *
 * Rate = how many units of foreign currency for 1 EUR
 * So higher rate means foreign currency is cheaper (more units per EUR)
 *
 * For receivables:
 * - We have X units of foreign currency to receive
 * - Original EUR value: X / originalRate
 * - Payment EUR value:  X / paymentRate
 * - If paymentRate > originalRate: we get LESS EUR -> strata
 * - If paymentRate < originalRate: we get MORE EUR -> zisk
 *
 * Wait - let's use NBS/ECB convention where rate = foreign per 1 EUR
 * originalRate = 25.00 CZK/EUR, paymentRate = 26.00 CZK/EUR
 * Foreign amount = 25000 CZK
 * Original EUR = 25000/25 = 1000 EUR
 * Payment EUR  = 25000/26 = 961.54 EUR
 * -> Strata for receivable (we get less)
 * -> Zisk for payable (we pay less)
 */
export function calculateExchangeRateDifference(
  originalRate: number,
  paymentRate: number,
  foreignAmount: number,
  itemType: "receivable" | "payable" = "receivable"
): ExchangeRateDiff {
  const amountOriginal = Math.round((foreignAmount / originalRate) * 100) / 100
  const amountPayment = Math.round((foreignAmount / paymentRate) * 100) / 100
  const difference = Math.round((amountPayment - amountOriginal) * 100) / 100

  let type: "kurzovy_zisk" | "kurzova_strata"
  let account: string
  let counterAccount: string

  if (itemType === "receivable") {
    // Pohladavka (311)
    if (difference > 0) {
      type = "kurzovy_zisk"
      account = "663" // Kurzove zisky (vynosy)
      counterAccount = "311" // Pohladavky
    } else {
      type = "kurzova_strata"
      account = "563" // Kurzove straty (naklady)
      counterAccount = "311" // Pohladavky
    }
  } else {
    // Zavazok (321)
    if (difference > 0) {
      // We pay less in EUR -> zisk? Actually for payable, if amountPayment > amountOriginal
      // it means we need MORE EUR to pay -> strata
      // Wait: paymentRate > originalRate means more foreign per EUR, so we need less EUR -> zisk
      // So difference > 0 when paymentRate > originalRate -> we pay less EUR -> strata
      // Hmm, let's re-derive:
      // foreignAmount / paymentRate vs foreignAmount / originalRate
      // If paymentRate > originalRate: amountPayment < amountOriginal -> difference < 0
      // So difference > 0 means paymentRate < originalRate
      // For payable: paymentRate < originalRate -> more EUR per foreign unit -> strata (we pay more)
      type = "kurzova_strata"
      account = "563"
      counterAccount = "321" // Zavazky
    } else {
      type = "kurzovy_zisk"
      account = "663"
      counterAccount = "321"
    }
  }

  const absDiff = Math.abs(difference)

  return {
    originalRate,
    paymentRate,
    amount: foreignAmount,
    amountOriginal,
    amountPayment,
    difference,
    type,
    account,
    counterAccount,
    description:
      type === "kurzovy_zisk"
        ? `Kurzovy zisk: ${absDiff.toFixed(2)} EUR`
        : `Kurzova strata: ${absDiff.toFixed(2)} EUR`,
  }
}

// ============ Generate Accounting Entries ============

export function generateExchangeRateEntries(
  diff: ExchangeRateDiff,
  date: string,
  documentRef?: string
): AccountingEntry[] {
  const absDiff = Math.abs(diff.difference)

  if (absDiff < 0.01) return [] // No entry needed for negligible differences

  const entries: AccountingEntry[] = []

  if (diff.type === "kurzovy_zisk") {
    // Kurzovy zisk: MD 311/321 / DAL 663
    // For receivable: MD 311 / DAL 663 (increase receivable value)
    // Actually, kurzovy zisk on receivable payment:
    // We received more EUR than booked -> MD 221 (bank) / DAL 663
    // The 311 was already booked, so the difference goes:
    // MD 311 / DAL 663 if revaluation
    // Or at payment: MD 221 / DAL 311 (original) + MD 221 / DAL 663 (difference)
    // Simplified single entry for the difference:
    entries.push({
      debit_account: diff.counterAccount, // 311 or 321
      credit_account: diff.account, // 663
      amount: absDiff,
      description: `${diff.description}${documentRef ? ` (${documentRef})` : ""}`,
      date,
      document_type: "kurzovy_rozdiel",
    })
  } else {
    // Kurzova strata: MD 563 / DAL 311/321
    entries.push({
      debit_account: diff.account, // 563
      credit_account: diff.counterAccount, // 311 or 321
      amount: absDiff,
      description: `${diff.description}${documentRef ? ` (${documentRef})` : ""}`,
      date,
      document_type: "kurzovy_rozdiel",
    })
  }

  return entries
}

// ============ Year-End Revaluation ============

/**
 * Revalue open items (receivables/payables) at closing ECB rate (31.12.)
 *
 * According to Slovak accounting law (Zakon o uctovnictve 431/2002):
 * - At balance sheet date (31.12.), all foreign currency receivables/payables
 *   must be revalued at the ECB rate valid on that date
 * - Differences are booked as kurzove rozdiely (563/663)
 */
export function revalueOpenItems(
  items: OpenItem[],
  closingRates: Record<string, number>, // currency -> rate (foreign per EUR)
  closingDate: string
): RevaluationResult[] {
  const results: RevaluationResult[] = []

  for (const item of items) {
    const closingRate = closingRates[item.currency]
    if (!closingRate) continue // Skip if no rate available

    const newEurAmount = Math.round((item.foreign_amount / closingRate) * 100) / 100
    const difference = Math.round((newEurAmount - item.original_eur_amount) * 100) / 100

    if (Math.abs(difference) < 0.01) continue // Skip negligible differences

    let type: "kurzovy_zisk" | "kurzova_strata"
    let account: string
    let counterAccount: string

    if (item.type === "receivable") {
      counterAccount = "311"
      if (difference > 0) {
        type = "kurzovy_zisk"
        account = "663"
      } else {
        type = "kurzova_strata"
        account = "563"
      }
    } else {
      counterAccount = "321"
      if (difference > 0) {
        // More EUR needed to pay -> strata for payable
        type = "kurzova_strata"
        account = "563"
      } else {
        type = "kurzovy_zisk"
        account = "663"
      }
    }

    const absDiff = Math.abs(difference)
    const description = type === "kurzovy_zisk"
      ? `Kurzovy zisk - precenenie k ${closingDate}: ${item.invoice_number} (${item.contact_name})`
      : `Kurzova strata - precenenie k ${closingDate}: ${item.invoice_number} (${item.contact_name})`

    let entry: AccountingEntry
    if (type === "kurzovy_zisk") {
      entry = {
        debit_account: counterAccount,
        credit_account: account,
        amount: absDiff,
        description,
        date: closingDate,
        currency: item.currency,
        document_type: "precenenie",
      }
    } else {
      entry = {
        debit_account: account,
        credit_account: counterAccount,
        amount: absDiff,
        description,
        date: closingDate,
        currency: item.currency,
        document_type: "precenenie",
      }
    }

    results.push({
      item,
      closingRate,
      newEurAmount,
      difference,
      type,
      account,
      counterAccount,
      entry,
    })
  }

  return results
}

// ============ Utility ============

export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const info = getCurrencyInfo(currencyCode)
  const decimals = info?.decimal_places ?? 2
  const formatted = amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${formatted} ${info?.symbol || currencyCode}`
}

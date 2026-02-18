/**
 * DPH (VAT) Calculator for Slovak VAT Return
 *
 * Calculates output VAT (from issued invoices) and input VAT (from received invoices)
 * grouped by VAT rates (23%, 19%, 5%, 0%).
 */

export interface DPHData {
  // Vystupna DPH (output VAT - from vydane faktury)
  output_vat_base_23: number
  output_vat_amount_23: number
  output_vat_base_19: number
  output_vat_amount_19: number
  output_vat_base_5: number
  output_vat_amount_5: number
  output_vat_total: number

  // Vstupna DPH (input VAT - from prijate faktury)
  input_vat_base_23: number
  input_vat_amount_23: number
  input_vat_base_19: number
  input_vat_amount_19: number
  input_vat_base_5: number
  input_vat_amount_5: number
  input_vat_total: number

  // Vysledok
  own_tax_liability: number // vlastna danova povinnost (output - input > 0)
  excess_deduction: number // nadmerny odpocet (input - output > 0)

  // Statistiky
  issued_invoice_count: number
  received_invoice_count: number

  // Riadky 01-37 pre DPH priznanie podla XSD FS SR
  r01: number // Dodanie tovarov a sluzieb - zaklad 23%
  r02: number // DPH 23%
  r03: number // Dodanie - zaklad 19%
  r04: number // DPH 19%
  r05: number // Dodanie - zaklad 5%
  r06: number // DPH 5%
  r07: number // Dodanie oslobodene od dane
  r08: number // Nadobudnutie tovaru z EU - zaklad
  r09: number // Nadobudnutie tovaru z EU - DPH
  r10: number // Prijate sluzby z EU par.15 - zaklad
  r11: number // Prijate sluzby z EU par.15 - DPH
  r12: number // Prijate sluzby z tretich krajin - zaklad
  r13: number // Prijate sluzby z tretich krajin - DPH
  r14: number // Tuzemsky prenos danovej povinnosti - zaklad
  r15: number // Tuzemsky prenos danovej povinnosti - DPH
  r16: number // Dovoz tovaru - zaklad
  r17: number // Dovoz tovaru - DPH
  r18: number // Oprava zakladu dane par.25 ods.1 pism.a-c - zaklad
  r19: number // Oprava DPH par.25 ods.1 pism.a-c
  r20: number // Oprava zakladu dane par.25 ods.1 pism.d-f - zaklad
  r21: number // Oprava DPH par.25 ods.1 pism.d-f
  r22: number // Dan na vstupe - z tuzemskych dodani
  r23: number // Dan na vstupe - z nadobudnutia tovaru z EU
  r24: number // Dan na vstupe - z dovozu tovaru
  r25: number // Dan na vstupe - pouzitie koeficientu
  r26: number // Oprava odpocitanej dane par.53
  r27: number // Dan na vstupe celkom (r22+r23+r24-r25+r26)
  r28: number // Dan na vystupe celkom
  r29: number // Odpocet dane celkom
  r30: number // Vlastna danova povinnost (r28-r29 ak kladne)
  r31: number // Nadmerny odpocet (r29-r28 ak kladne)
  r32: number // Koeficient podla par.50
  r33: number // Uplynuli 3 zdanovacie obdobia od nadmerneho odpoctu
  r34: number // Danova povinnost po korekcii
  r35: number // Odpocet dane z EU
  r36: number // Dan pri zruseni registracie par.81
  r37: number // Dan celkom
}

export interface InvoiceWithItems {
  id: string
  type: string // vydana | prijata | dobropis | zalohova | proforma
  number: string
  issue_date: string
  subtotal: number
  vat_amount: number
  total: number
  status: string
  contact_id: string | null
  invoice_items: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  subtotal: number
  vat_amount: number
  total: number
}

/**
 * Round a number to 2 decimal places.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Calculate DPH (VAT) return data from invoices.
 *
 * @param invoices - All invoices in the period (with items)
 * @param periodFrom - Start of period (YYYY-MM-DD)
 * @param periodTo - End of period (YYYY-MM-DD)
 * @returns DPHData with calculated VAT amounts
 */
export function calculateDPH(
  invoices: InvoiceWithItems[],
  periodFrom: string,
  periodTo: string
): DPHData {
  const data: DPHData = {
    output_vat_base_23: 0,
    output_vat_amount_23: 0,
    output_vat_base_19: 0,
    output_vat_amount_19: 0,
    output_vat_base_5: 0,
    output_vat_amount_5: 0,
    output_vat_total: 0,

    input_vat_base_23: 0,
    input_vat_amount_23: 0,
    input_vat_base_19: 0,
    input_vat_amount_19: 0,
    input_vat_base_5: 0,
    input_vat_amount_5: 0,
    input_vat_total: 0,

    own_tax_liability: 0,
    excess_deduction: 0,

    issued_invoice_count: 0,
    received_invoice_count: 0,

    r01: 0, r02: 0, r03: 0, r04: 0, r05: 0, r06: 0, r07: 0,
    r08: 0, r09: 0, r10: 0, r11: 0, r12: 0, r13: 0,
    r14: 0, r15: 0, r16: 0, r17: 0,
    r18: 0, r19: 0, r20: 0, r21: 0,
    r22: 0, r23: 0, r24: 0, r25: 0, r26: 0, r27: 0,
    r28: 0, r29: 0, r30: 0, r31: 0,
    r32: 0, r33: 0, r34: 0, r35: 0, r36: 0, r37: 0,
  }

  // Filter invoices to the period
  const periodInvoices = invoices.filter((inv) => {
    const issueDate = inv.issue_date
    return issueDate >= periodFrom && issueDate <= periodTo
  })

  // Separate issued (vydane) and received (prijate) invoices
  const issuedInvoices = periodInvoices.filter(
    (inv) => inv.type === "vydana" || inv.type === "proforma" || inv.type === "zalohova"
  )
  const receivedInvoices = periodInvoices.filter(
    (inv) => inv.type === "prijata"
  )

  // Credit notes (dobropisy) - determine direction based on original type
  // Dobropisy from vydana reduce output VAT, from prijata reduce input VAT
  const creditNotes = periodInvoices.filter((inv) => inv.type === "dobropis")

  data.issued_invoice_count = issuedInvoices.length
  data.received_invoice_count = receivedInvoices.length

  // Process issued invoices (output VAT)
  for (const invoice of issuedInvoices) {
    const items = invoice.invoice_items || []
    for (const item of items) {
      const vatRate = Number(item.vat_rate)
      const base = Number(item.subtotal) || 0
      const vat = Number(item.vat_amount) || 0

      if (vatRate === 23) {
        data.output_vat_base_23 += base
        data.output_vat_amount_23 += vat
      } else if (vatRate === 19) {
        data.output_vat_base_19 += base
        data.output_vat_amount_19 += vat
      } else if (vatRate === 5) {
        data.output_vat_base_5 += base
        data.output_vat_amount_5 += vat
      }
      // 0% VAT items are exempt, no output VAT
    }
  }

  // Process received invoices (input VAT)
  for (const invoice of receivedInvoices) {
    const items = invoice.invoice_items || []
    for (const item of items) {
      const vatRate = Number(item.vat_rate)
      const base = Number(item.subtotal) || 0
      const vat = Number(item.vat_amount) || 0

      if (vatRate === 23) {
        data.input_vat_base_23 += base
        data.input_vat_amount_23 += vat
      } else if (vatRate === 19) {
        data.input_vat_base_19 += base
        data.input_vat_amount_19 += vat
      } else if (vatRate === 5) {
        data.input_vat_base_5 += base
        data.input_vat_amount_5 += vat
      }
    }
  }

  // Process credit notes - they reduce the respective VAT
  // Credit notes have negative amounts (or we subtract them)
  for (const invoice of creditNotes) {
    const items = invoice.invoice_items || []
    for (const item of items) {
      const vatRate = Number(item.vat_rate)
      const base = Math.abs(Number(item.subtotal) || 0)
      const vat = Math.abs(Number(item.vat_amount) || 0)

      // Credit notes reduce output VAT (they are issued as corrections)
      if (vatRate === 23) {
        data.output_vat_base_23 -= base
        data.output_vat_amount_23 -= vat
      } else if (vatRate === 19) {
        data.output_vat_base_19 -= base
        data.output_vat_amount_19 -= vat
      } else if (vatRate === 5) {
        data.output_vat_base_5 -= base
        data.output_vat_amount_5 -= vat
      }
    }
  }

  // Round all values
  data.output_vat_base_23 = round2(data.output_vat_base_23)
  data.output_vat_amount_23 = round2(data.output_vat_amount_23)
  data.output_vat_base_19 = round2(data.output_vat_base_19)
  data.output_vat_amount_19 = round2(data.output_vat_amount_19)
  data.output_vat_base_5 = round2(data.output_vat_base_5)
  data.output_vat_amount_5 = round2(data.output_vat_amount_5)

  data.input_vat_base_23 = round2(data.input_vat_base_23)
  data.input_vat_amount_23 = round2(data.input_vat_amount_23)
  data.input_vat_base_19 = round2(data.input_vat_base_19)
  data.input_vat_amount_19 = round2(data.input_vat_amount_19)
  data.input_vat_base_5 = round2(data.input_vat_base_5)
  data.input_vat_amount_5 = round2(data.input_vat_amount_5)

  // Calculate totals
  data.output_vat_total = round2(
    data.output_vat_amount_23 + data.output_vat_amount_19 + data.output_vat_amount_5
  )
  data.input_vat_total = round2(
    data.input_vat_amount_23 + data.input_vat_amount_19 + data.input_vat_amount_5
  )

  // Calculate result
  const difference = round2(data.output_vat_total - data.input_vat_total)
  if (difference > 0) {
    data.own_tax_liability = difference
    data.excess_deduction = 0
  } else {
    data.own_tax_liability = 0
    data.excess_deduction = round2(Math.abs(difference))
  }

  // Map to rows r01-r37 for DPH priznanie
  // Riadky 01-06: Dodanie tovarov a sluzieb (vystup)
  data.r01 = data.output_vat_base_23
  data.r02 = data.output_vat_amount_23
  data.r03 = data.output_vat_base_19
  data.r04 = data.output_vat_amount_19
  data.r05 = data.output_vat_base_5
  data.r06 = data.output_vat_amount_5
  // r07: Oslobodene dodanie - nema datovy zdroj, ostava 0
  // r08-r17: EU nadobudnutia, sluzby, prenos, dovoz - specialne typy, nema datovy zdroj
  // r18-r21: Opravy - nema datovy zdroj

  // Riadky 22-27: Dan na vstupe
  data.r22 = data.input_vat_total // z tuzemskych dodani
  // r23-r26: specialne typy vstupu
  data.r27 = data.r22 + data.r23 + data.r24 - data.r25 + data.r26

  // Riadky 28-31: Vysledok
  data.r28 = data.output_vat_total // dan na vystupe celkom
  data.r29 = data.r27 // odpocet dane celkom
  data.r30 = data.own_tax_liability
  data.r31 = data.excess_deduction

  // r32-r36: Korekcie
  // r37: Dan celkom
  data.r37 = data.r30 > 0 ? data.r30 : round2(-data.r31)

  return data
}

/**
 * eKasa Receipt Service
 * Handles receipt registration, OKP/PKP generation, and offline queue.
 * Implements the eKasa protocol per Zákon č. 289/2008 Z.z. o používaní
 * elektronickej registračnej pokladnice.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { logger } from "@/lib/logging/logger"

// ===================== Types =====================

export interface EKasaReceiptItem {
  name: string
  quantity: number
  unit: string
  unit_price: number
  total_price: number
  vat_rate: number // 23, 19, 5, 0
  discount?: number
}

export type ReceiptType = "sale" | "refund" | "deposit" | "withdrawal"
export type PaymentMethod = "cash" | "card" | "transfer" | "voucher" | "other"

export interface CreateReceiptInput {
  companyId: string
  deviceId: string
  cashRegisterId?: string
  receiptType: ReceiptType
  items: EKasaReceiptItem[]
  paymentMethod: PaymentMethod
  cashReceived?: number
  customerName?: string
  customerIco?: string
  customerDic?: string
  customerIcDph?: string
  invoiceId?: string
}

export interface ReceiptResult {
  id: string
  receiptNumber: string
  uid?: string
  okp: string
  totalAmount: number
  vatBreakdown: {
    base23: number; vat23: number
    base19: number; vat19: number
    base5: number; vat5: number
    base0: number
  }
  changeAmount: number
  status: "confirmed" | "offline" | "error"
  errorMessage?: string
}

// ===================== OKP/PKP Generation =====================

/**
 * Generate OKP (Overovací kód podnikateľa).
 * OKP is derived from PKP by truncation (first 16 hex chars of SHA256 of PKP).
 * In production, PKP is a RSA signature; here we simulate with SHA-256.
 */
async function generateOKP(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  // OKP = first 16 hex chars, formatted as XXXX-XXXX-XXXX-XXXX
  const okp16 = hashHex.substring(0, 16).toUpperCase()
  return `${okp16.substring(0, 4)}-${okp16.substring(4, 8)}-${okp16.substring(8, 12)}-${okp16.substring(12, 16)}`
}

/**
 * Generate PKP (Podpisový kód podnikateľa).
 * PKP is an RSA-SHA256 signature of receipt data.
 * In production, this would use the certificate from the eKasa device.
 * Here we simulate with HMAC-SHA256.
 */
async function generatePKP(data: string): Promise<string> {
  const signingKey = process.env.EKASA_SIGNING_KEY || "ekasa-default-signing-key"
  const encoder = new TextEncoder()
  const keyData = encoder.encode(signingKey)

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
}

/**
 * Build the data string for OKP/PKP generation per eKasa spec.
 * Format: DIC;DKP;ReceiptNumber;Date;TotalAmount
 */
function buildSigningData(
  dic: string,
  dkp: string,
  receiptNumber: string,
  date: string,
  totalAmount: number
): string {
  return `${dic};${dkp};${receiptNumber};${date};${totalAmount.toFixed(2)}`
}

// ===================== Receipt Processing =====================

/**
 * Calculate VAT breakdown from items
 */
function calculateVatBreakdown(items: EKasaReceiptItem[]): {
  totalAmount: number
  base23: number; vat23: number
  base19: number; vat19: number
  base5: number; vat5: number
  base0: number
} {
  let base23 = 0, vat23 = 0
  let base19 = 0, vat19 = 0
  let base5 = 0, vat5 = 0
  let base0 = 0
  let totalAmount = 0

  for (const item of items) {
    const lineTotal = round2(item.quantity * item.unit_price - (item.discount || 0))
    totalAmount += lineTotal

    const vatRate = item.vat_rate
    // Reverse-calculate base from inclusive price
    const base = round2(lineTotal / (1 + vatRate / 100))
    const vat = round2(lineTotal - base)

    switch (vatRate) {
      case 23: base23 += base; vat23 += vat; break
      case 19: base19 += base; vat19 += vat; break
      case 5: base5 += base; vat5 += vat; break
      case 0: base0 += lineTotal; break
    }
  }

  return {
    totalAmount: round2(totalAmount),
    base23: round2(base23), vat23: round2(vat23),
    base19: round2(base19), vat19: round2(vat19),
    base5: round2(base5), vat5: round2(vat5),
    base0: round2(base0),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Generate next receipt number for a device
 */
async function getNextReceiptNumber(companyId: string, deviceId: string): Promise<string> {
  const db = createAdminClient()
  const today = new Date().toISOString().split("T")[0].replace(/-/g, "")

  // Count today's receipts for this device
  const { count } = await (db.from("ekasa_receipts") as any)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("device_id", deviceId)
    .eq("receipt_date", new Date().toISOString().split("T")[0])

  const seq = String((count || 0) + 1).padStart(4, "0")
  return `BL-${today}-${seq}`
}

// ===================== Main Service Functions =====================

/**
 * Create and register an eKasa receipt.
 * Attempts to send to eKasa server; if offline, stores locally.
 */
export async function createReceipt(input: CreateReceiptInput): Promise<ReceiptResult> {
  const db = createAdminClient()

  // Get device info
  const { data: device, error: deviceError } = await (db.from("ekasa_devices") as any)
    .select("*")
    .eq("id", input.deviceId)
    .eq("company_id", input.companyId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single()

  if (deviceError || !device) {
    throw new Error("eKasa zariadenie nenájdené alebo je neaktívne")
  }

  // Calculate amounts
  const vat = calculateVatBreakdown(input.items)
  const changeAmount = input.paymentMethod === "cash" && input.cashReceived
    ? round2(input.cashReceived - vat.totalAmount)
    : 0

  // Generate receipt number
  const receiptNumber = await getNextReceiptNumber(input.companyId, input.deviceId)

  // Build signing data and generate OKP/PKP
  const signingData = buildSigningData(
    device.dic,
    device.cash_register_code,
    receiptNumber,
    new Date().toISOString(),
    vat.totalAmount
  )

  const pkp = await generatePKP(signingData)
  const okp = await generateOKP(pkp)

  // Save receipt to DB
  const { data: receipt, error: insertError } = await (db.from("ekasa_receipts") as any)
    .insert({
      company_id: input.companyId,
      device_id: input.deviceId,
      cash_register_id: input.cashRegisterId || null,
      receipt_number: receiptNumber,
      receipt_type: input.receiptType,
      total_amount: vat.totalAmount,
      vat_base_23: vat.base23,
      vat_amount_23: vat.vat23,
      vat_base_19: vat.base19,
      vat_amount_19: vat.vat19,
      vat_base_5: vat.base5,
      vat_amount_5: vat.vat5,
      vat_base_0: vat.base0,
      payment_method: input.paymentMethod,
      cash_received: input.cashReceived || null,
      change_amount: changeAmount > 0 ? changeAmount : null,
      items: input.items,
      customer_name: input.customerName || null,
      customer_ico: input.customerIco || null,
      customer_dic: input.customerDic || null,
      customer_ic_dph: input.customerIcDph || null,
      invoice_id: input.invoiceId || null,
      okp,
      pkp,
      status: "pending",
      receipt_date: new Date().toISOString().split("T")[0],
      receipt_time: new Date().toTimeString().split(" ")[0],
    })
    .select("id")
    .single()

  if (insertError) {
    throw new Error(`Chyba pri ukladaní dokladu: ${insertError.message}`)
  }

  // Try to send to eKasa server
  let status: ReceiptResult["status"] = "offline"
  let uid: string | undefined
  let errorMessage: string | undefined

  try {
    const sendResult = await sendToEKasa(device, {
      receiptNumber,
      receiptType: input.receiptType,
      totalAmount: vat.totalAmount,
      vat,
      items: input.items,
      paymentMethod: input.paymentMethod,
      okp,
      pkp,
    })

    if (sendResult.success) {
      uid = sendResult.uid
      status = "confirmed"

      await (db.from("ekasa_receipts") as any)
        .update({
          uid: sendResult.uid,
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        })
        .eq("id", receipt.id)
    } else {
      throw new Error(sendResult.error || "eKasa server error")
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Neznáma chyba"
    errorMessage = msg
    status = "offline"

    // Store as offline - will be synced later
    await (db.from("ekasa_receipts") as any)
      .update({
        status: "offline",
        error_message: msg,
      })
      .eq("id", receipt.id)

    logger.warn("eKasa receipt stored offline", {
      module: "ekasa",
      data: { receiptNumber, error: msg },
    })
  }

  return {
    id: receipt.id,
    receiptNumber,
    uid,
    okp,
    totalAmount: vat.totalAmount,
    vatBreakdown: {
      base23: vat.base23, vat23: vat.vat23,
      base19: vat.base19, vat19: vat.vat19,
      base5: vat.base5, vat5: vat.vat5,
      base0: vat.base0,
    },
    changeAmount,
    status,
    errorMessage,
  }
}

/**
 * Send receipt to eKasa server.
 * In production, this communicates with the FS SR eKasa API.
 * Currently implements a simulation mode.
 */
async function sendToEKasa(
  device: any,
  data: {
    receiptNumber: string
    receiptType: ReceiptType
    totalAmount: number
    vat: any
    items: EKasaReceiptItem[]
    paymentMethod: PaymentMethod
    okp: string
    pkp: string
  }
): Promise<{ success: boolean; uid?: string; error?: string }> {
  const eKasaUrl = process.env.EKASA_API_URL

  if (!eKasaUrl) {
    // Simulation mode - generate a fake UID
    const fakeUid = `O-${crypto.randomUUID().replace(/-/g, "").substring(0, 16).toUpperCase()}`
    return { success: true, uid: fakeUid }
  }

  // Production mode - send to actual eKasa API
  try {
    const response = await fetch(`${eKasaUrl}/api/v1/receipts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.EKASA_API_KEY}`,
      },
      body: JSON.stringify({
        dic: device.dic,
        cashRegisterCode: device.cash_register_code,
        receiptNumber: data.receiptNumber,
        receiptType: data.receiptType,
        totalAmount: data.totalAmount,
        items: data.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
          vatRate: item.vat_rate,
        })),
        paymentMethod: data.paymentMethod,
        okp: data.okp,
        pkp: data.pkp,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return { success: false, error: `eKasa HTTP ${response.status}: ${errorBody}` }
    }

    const result = await response.json()
    return { success: true, uid: result.uid }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Neznáma chyba"
    return { success: false, error: `eKasa connection error: ${msg}` }
  }
}

/**
 * Sync offline receipts with eKasa server.
 * Called by cron job or manually.
 */
export async function syncOfflineReceipts(companyId?: string): Promise<{
  synced: number
  failed: number
  errors: string[]
}> {
  const db = createAdminClient()
  const result = { synced: 0, failed: 0, errors: [] as string[] }

  let query = (db.from("ekasa_receipts") as any)
    .select("*, device:ekasa_devices(*)")
    .in("status", ["offline", "error"])
    .order("created_at", { ascending: true })
    .limit(50)

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  const { data: receipts } = await query

  if (!receipts || receipts.length === 0) return result

  for (const receipt of receipts) {
    if (!receipt.device) continue

    try {
      const sendResult = await sendToEKasa(receipt.device, {
        receiptNumber: receipt.receipt_number,
        receiptType: receipt.receipt_type,
        totalAmount: receipt.total_amount,
        vat: {
          base23: receipt.vat_base_23, vat23: receipt.vat_amount_23,
          base19: receipt.vat_base_19, vat19: receipt.vat_amount_19,
          base5: receipt.vat_base_5, vat5: receipt.vat_amount_5,
          base0: receipt.vat_base_0,
        },
        items: receipt.items,
        paymentMethod: receipt.payment_method,
        okp: receipt.okp,
        pkp: receipt.pkp,
      })

      if (sendResult.success) {
        await (db.from("ekasa_receipts") as any)
          .update({
            uid: sendResult.uid,
            status: "confirmed",
            confirmed_at: new Date().toISOString(),
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", receipt.id)

        result.synced++
      } else {
        throw new Error(sendResult.error)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Neznáma chyba"
      result.failed++
      result.errors.push(`${receipt.receipt_number}: ${msg}`)
    }
  }

  return result
}

/**
 * Create daily closing (denná uzávierka) for a device.
 */
export async function createDailyClosing(
  companyId: string,
  deviceId: string,
  date: string
): Promise<{
  totalReceipts: number
  totalAmount: number
  totalVat: number
  totalCash: number
  totalCard: number
  totalRefunds: number
}> {
  const db = createAdminClient()

  // Aggregate receipts for the day
  const { data: receipts } = await (db.from("ekasa_receipts") as any)
    .select("receipt_type, total_amount, payment_method, vat_amount_23, vat_amount_19, vat_amount_5")
    .eq("company_id", companyId)
    .eq("device_id", deviceId)
    .eq("receipt_date", date)
    .in("status", ["confirmed", "offline"])

  if (!receipts || receipts.length === 0) {
    return { totalReceipts: 0, totalAmount: 0, totalVat: 0, totalCash: 0, totalCard: 0, totalRefunds: 0 }
  }

  let totalAmount = 0, totalVat = 0, totalCash = 0, totalCard = 0, totalRefunds = 0
  let saleCount = 0, refundCount = 0

  for (const r of receipts) {
    const amount = Number(r.total_amount) || 0
    const vat = (Number(r.vat_amount_23) || 0) + (Number(r.vat_amount_19) || 0) + (Number(r.vat_amount_5) || 0)

    if (r.receipt_type === "refund") {
      totalRefunds += amount
      refundCount++
    } else if (r.receipt_type === "sale") {
      totalAmount += amount
      saleCount++
    }

    totalVat += vat

    if (r.payment_method === "cash") totalCash += amount
    if (r.payment_method === "card") totalCard += amount
  }

  // Save daily closing
  await (db.from("ekasa_imports") as any)
    .upsert({
      company_id: companyId,
      device_id: deviceId,
      date,
      total_receipts: receipts.length,
      total_amount: round2(totalAmount),
      total_vat: round2(totalVat),
      total_cash: round2(totalCash),
      total_card: round2(totalCard),
      total_refunds: round2(totalRefunds),
      receipt_count_sale: saleCount,
      receipt_count_refund: refundCount,
    }, { onConflict: "company_id,device_id,date" })

  return {
    totalReceipts: receipts.length,
    totalAmount: round2(totalAmount),
    totalVat: round2(totalVat),
    totalCash: round2(totalCash),
    totalCard: round2(totalCard),
    totalRefunds: round2(totalRefunds),
  }
}

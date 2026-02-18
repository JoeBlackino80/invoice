import { NextResponse } from "next/server"
import { getAuthenticatedClient } from "@/lib/supabase/admin"
import { createReceipt, type CreateReceiptInput } from "@/lib/edane/ekasa-receipt-service"

/**
 * GET /api/ekasa/receipts - List eKasa receipts
 */
export async function GET(request: Request) {
  const { user, db, error } = await getAuthenticatedClient()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const deviceId = searchParams.get("device_id")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  let query = (db.from("ekasa_receipts") as any)
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (deviceId) query = query.eq("device_id", deviceId)
  if (dateFrom) query = query.gte("receipt_date", dateFrom)
  if (dateTo) query = query.lte("receipt_date", dateTo)
  if (status) query = query.eq("status", status)

  const { data, error: dbError, count } = await query

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({
    data: data || [],
    pagination: { total: count || 0, page, limit, totalPages: Math.ceil((count || 0) / limit) },
  })
}

/**
 * POST /api/ekasa/receipts - Create a new eKasa receipt
 */
export async function POST(request: Request) {
  const { user, db, error } = await getAuthenticatedClient()
  if (error) return error

  const body = await request.json()

  if (!body.company_id || !body.device_id || !body.items?.length) {
    return NextResponse.json(
      { error: "company_id, device_id a items sú povinné" },
      { status: 400 }
    )
  }

  try {
    const input: CreateReceiptInput = {
      companyId: body.company_id,
      deviceId: body.device_id,
      cashRegisterId: body.cash_register_id,
      receiptType: body.receipt_type || "sale",
      items: body.items,
      paymentMethod: body.payment_method || "cash",
      cashReceived: body.cash_received,
      customerName: body.customer_name,
      customerIco: body.customer_ico,
      customerDic: body.customer_dic,
      customerIcDph: body.customer_ic_dph,
      invoiceId: body.invoice_id,
    }

    const result = await createReceipt(input)

    return NextResponse.json({
      data: result,
      message: result.status === "confirmed"
        ? `Doklad ${result.receiptNumber} bol úspešne zaregistrovaný v eKasa`
        : `Doklad ${result.receiptNumber} bol uložený offline (bude odoslaný pri synchronizácii)`,
    }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

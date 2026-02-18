import { NextResponse } from "next/server"
import { getAuthenticatedClient } from "@/lib/supabase/admin"
import { syncOfflineReceipts, createDailyClosing } from "@/lib/edane/ekasa-receipt-service"

/**
 * POST /api/ekasa/sync - Sync offline receipts with eKasa server
 */
export async function POST(request: Request) {
  const { user, db, error } = await getAuthenticatedClient()
  if (error) return error

  const body = await request.json()
  const companyId = body.company_id

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  try {
    const result = await syncOfflineReceipts(companyId)

    return NextResponse.json({
      success: true,
      ...result,
      message: result.synced > 0
        ? `Synchronizovaných ${result.synced} dokladov`
        : "Žiadne doklady na synchronizáciu",
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PUT /api/ekasa/sync - Create daily closing for a device
 */
export async function PUT(request: Request) {
  const { user, db, error } = await getAuthenticatedClient()
  if (error) return error

  const body = await request.json()

  if (!body.company_id || !body.device_id || !body.date) {
    return NextResponse.json(
      { error: "company_id, device_id a date sú povinné" },
      { status: 400 }
    )
  }

  try {
    const result = await createDailyClosing(body.company_id, body.device_id, body.date)

    return NextResponse.json({
      success: true,
      ...result,
      message: `Denná uzávierka za ${body.date}: ${result.totalReceipts} dokladov, ${result.totalAmount.toFixed(2)} EUR`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

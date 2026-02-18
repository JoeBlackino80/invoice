import { NextResponse } from "next/server"
import { syncOfflineReceipts } from "@/lib/edane/ekasa-receipt-service"

/**
 * POST /api/cron/ekasa-sync
 * Sync offline eKasa receipts with the eKasa server.
 * Called every 15 minutes by Vercel Cron.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await syncOfflineReceipts()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznáma chyba"
    console.error("[CRON] eKasa sync error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

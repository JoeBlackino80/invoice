import { NextResponse } from "next/server"
import { processEmailQueue, cleanupQueue } from "@/lib/email/queue"

/**
 * POST /api/cron/email-queue
 * Process pending emails from the queue.
 * Called by Vercel Cron every minute.
 */
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await processEmailQueue(20)

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznáma chyba"
    console.error("[CRON] Email queue processing error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/cron/email-queue
 * Clean up old queue entries (keep logs). Called weekly.
 */
export async function DELETE(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const deleted = await cleanupQueue(30)
    return NextResponse.json({ success: true, deleted })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznáma chyba"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

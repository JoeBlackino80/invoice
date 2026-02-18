import { NextResponse } from "next/server"
import { getAuthenticatedClient } from "@/lib/supabase/admin"
import { getQueueStats } from "@/lib/email/queue"

/**
 * GET /api/settings/email-queue - Get email queue status and recent logs
 */
export async function GET(request: Request) {
  const { user, db, error } = await getAuthenticatedClient()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  try {
    // Get queue stats
    const stats = await getQueueStats(companyId)

    // Get recent email logs
    const { data: recentLogs } = await (db.from("email_log") as any)
      .select("id, to_email, subject, status, template_type, error_message, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50)

    // Get pending queue items
    const { data: pendingEmails } = await (db.from("email_queue") as any)
      .select("id, to_email, subject, status, priority, attempts, last_error, scheduled_for, created_at")
      .eq("company_id", companyId)
      .in("status", ["pending", "processing", "failed"])
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(20)

    return NextResponse.json({
      stats,
      recentLogs: recentLogs || [],
      pendingEmails: pendingEmails || [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

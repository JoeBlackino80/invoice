import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  checkAndCreateOverdueNotifications,
  checkAndCreateDeadlineNotifications,
  checkAndCreateLowStockNotifications,
} from "@/lib/notifications/notification-service"
import { checkAndSendNotificationEmail } from "@/lib/notifications/email-sender"

/**
 * POST /api/cron/overdue-check
 * Check for overdue invoices, approaching deadlines, and low stock.
 * Creates in-app notifications and queues email notifications.
 * Called daily by Vercel Cron.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()

  // Get all active companies
  const { data: companies } = await (db.from("companies") as any)
    .select("id, name")
    .is("deleted_at", null)

  if (!companies || companies.length === 0) {
    return NextResponse.json({ success: true, message: "Žiadne firmy" })
  }

  const results = {
    companies_checked: companies.length,
    overdue_notifications: 0,
    deadline_notifications: 0,
    low_stock_notifications: 0,
    errors: [] as string[],
  }

  for (const company of companies) {
    try {
      // Check overdue invoices
      await checkAndCreateOverdueNotifications(db, company.id)
      results.overdue_notifications++

      // Check approaching deadlines
      await checkAndCreateDeadlineNotifications(db, company.id)
      results.deadline_notifications++

      // Check low stock
      const stockNotifs = await checkAndCreateLowStockNotifications(db, company.id)
      results.low_stock_notifications += stockNotifs

      // Send email notifications for overdue invoices
      const today = new Date().toISOString().split("T")[0]
      const { data: overdueInvoices } = await (db.from("invoices") as any)
        .select("id, number, total_amount, currency, contact:contacts(name)")
        .eq("company_id", company.id)
        .in("status", ["odoslana", "po_splatnosti"])
        .lt("due_date", today)
        .is("deleted_at", null)
        .limit(50)

      for (const inv of (overdueInvoices || [])) {
        const daysOverdue = Math.floor(
          (Date.now() - new Date(inv.due_date).getTime()) / 86400000
        )
        await checkAndSendNotificationEmail(db, company.id, "invoice_overdue", {
          invoiceNumber: inv.number,
          contactName: inv.contact?.name || "Neznámy",
          amount: `${(inv.total_amount || 0).toFixed(2)} ${inv.currency || "EUR"}`,
          daysOverdue,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Neznáma chyba"
      results.errors.push(`${company.name}: ${msg}`)
      console.error(`[CRON] Overdue check error for ${company.name}:`, msg)
    }
  }

  return NextResponse.json({ success: true, ...results })
}

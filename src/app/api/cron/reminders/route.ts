import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendReminderEmail } from "@/lib/notifications/email-sender"

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()

  // Get all companies with reminders enabled
  const { data: companies } = await (db.from("companies") as any)
    .select("id, name, email, phone")
    .is("deleted_at", null)

  let totalReminders = 0
  let emailsQueued = 0

  for (const company of (companies || [])) {
    // Check company settings for reminder config
    const { data: settings } = await (db.from("company_settings") as any)
      .select("reminders_enabled, reminder_days_level1, reminder_days_level2, reminder_days_level3")
      .eq("company_id", company.id)
      .single()

    if (settings && settings.reminders_enabled === false) continue

    const level1Days = settings?.reminder_days_level1 || 7
    const level2Days = settings?.reminder_days_level2 || 14
    const level3Days = settings?.reminder_days_level3 || 30

    // Get overdue invoices
    const { data: overdueInvoices } = await (db.from("invoices") as any)
      .select("id, number, due_date, total_amount, paid_amount, contact_id, customer_name, customer_email, currency, issue_date, contact:contacts(id, name, email)")
      .eq("company_id", company.id)
      .in("status", ["odoslana", "ciastocne_uhradena", "po_splatnosti"])
      .lt("due_date", new Date().toISOString().split("T")[0])
      .is("deleted_at", null)

    for (const invoice of (overdueInvoices || [])) {
      const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / 86400000)

      // Determine which level
      let level = 0
      if (daysOverdue >= level3Days) level = 3
      else if (daysOverdue >= level2Days) level = 2
      else if (daysOverdue >= level1Days) level = 1

      if (level === 0) continue

      // Check if reminder for this level already exists
      const { data: existing } = await (db.from("reminders") as any)
        .select("id")
        .eq("invoice_id", invoice.id)
        .eq("level", level)
        .limit(1)

      if (existing && existing.length > 0) continue

      const contactEmail = invoice.contact?.email || invoice.customer_email
      const contactName = invoice.contact?.name || invoice.customer_name || "Neznámy"

      // Create reminder record
      await (db.from("reminders") as any).insert({
        company_id: company.id,
        invoice_id: invoice.id,
        level,
        notes: `Automatická upomienka úroveň ${level} - ${daysOverdue} dní po splatnosti`,
        sent_at: new Date().toISOString(),
        sent_to: contactEmail || "",
      })

      // Send email reminder via queue if contact has email
      if (contactEmail) {
        try {
          await sendReminderEmail({
            invoice: {
              id: invoice.id,
              number: invoice.number,
              total: invoice.total_amount || 0,
              currency: invoice.currency,
              issue_date: invoice.issue_date,
              due_date: invoice.due_date,
              customer_name: invoice.customer_name,
              contact: invoice.contact,
            },
            company: {
              id: company.id,
              name: company.name,
              email: company.email,
              phone: company.phone,
            },
            recipientEmail: contactEmail,
            daysOverdue,
            level,
          })
          emailsQueued++
        } catch {
          console.error(`[CRON] Failed to queue reminder for invoice ${invoice.number}`)
        }
      }

      // Update invoice status to po_splatnosti if not already
      await (db.from("invoices") as any)
        .update({ status: "po_splatnosti" })
        .eq("id", invoice.id)
        .neq("status", "po_splatnosti")

      // Create in-app notification
      await (db.from("notifications") as any).insert({
        company_id: company.id,
        type: "invoice_overdue",
        title: `Upomienka úroveň ${level}`,
        message: `Faktúra ${invoice.number} je ${daysOverdue} dní po splatnosti (${contactName})`,
        link: `/invoices`,
      })

      totalReminders++
    }
  }

  return NextResponse.json({
    success: true,
    reminders_created: totalReminders,
    emails_queued: emailsQueued,
  })
}

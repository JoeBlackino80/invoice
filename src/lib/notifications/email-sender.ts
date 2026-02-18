import type { SupabaseClient } from "@supabase/supabase-js"
import { queueEmail, queueEmailBatch } from "@/lib/email/queue"
import {
  invoiceOverdueTemplate,
  deadlineApproachingTemplate,
  paymentReceivedTemplate,
  genericNotificationTemplate,
} from "@/lib/notifications/email-templates"
import {
  invoiceEmailTemplate,
  reminderEmailTemplate,
  paymentConfirmationTemplate,
  portalTokenTemplate,
} from "@/lib/email/templates"
import type { NotificationType } from "@/lib/notifications/notification-service"

interface CompanyInfo {
  id: string
  name: string
  email?: string
  phone?: string
}

/**
 * Send notification email based on type and rule configuration.
 * Uses the email queue for reliable delivery.
 */
export async function sendNotificationEmail(params: {
  companyId: string
  companyName: string
  type: NotificationType
  recipientEmail: string
  data: Record<string, any>
}): Promise<string | null> {
  const { companyId, companyName, type, recipientEmail, data } = params

  let subject: string
  let html: string

  switch (type) {
    case "invoice_overdue": {
      const result = invoiceOverdueTemplate(
        data.invoiceNumber || "",
        data.contactName || "Neznámy",
        data.amount || "0.00 EUR",
        data.daysOverdue || 0,
        companyName
      )
      subject = result.subject
      html = result.html
      break
    }
    case "deadline_approaching": {
      const result = deadlineApproachingTemplate(
        data.deadlineName || "",
        data.dueDate || "",
        data.daysRemaining || 0,
        companyName
      )
      subject = result.subject
      html = result.html
      break
    }
    case "payment_received": {
      const result = paymentReceivedTemplate(
        data.invoiceNumber || "",
        data.amount || "0.00 EUR",
        data.contactName || "Neznámy",
        companyName
      )
      subject = result.subject
      html = result.html
      break
    }
    default: {
      const result = genericNotificationTemplate(
        data.title || "Notifikácia",
        data.message || "",
        companyName,
        data.actionUrl,
        data.actionLabel
      )
      subject = result.subject
      html = result.html
      break
    }
  }

  try {
    const queueId = await queueEmail({
      companyId,
      to: recipientEmail,
      subject,
      html,
      priority: type === "invoice_overdue" ? 3 : 5,
      templateType: `notification_${type}`,
      metadata: { notificationType: type, ...data },
    })
    return queueId
  } catch {
    console.error(`[EMAIL] Failed to queue notification email: ${type}`)
    return null
  }
}

/**
 * Send invoice email to customer (with PDF link).
 * Used when user clicks "Odoslať faktúru".
 */
export async function sendInvoiceEmail(params: {
  invoice: {
    id: string
    number: string
    total: number
    currency?: string
    issue_date: string
    due_date: string
    customer_name?: string
    contact?: { name: string; email?: string }
  }
  company: CompanyInfo
  recipientEmail: string
}): Promise<string> {
  const { invoice, company, recipientEmail } = params

  const html = invoiceEmailTemplate(invoice, {
    name: company.name,
    ico: undefined,
    email: company.email,
    phone: company.phone,
  })

  return queueEmail({
    companyId: company.id,
    to: recipientEmail,
    subject: `Faktúra č. ${invoice.number} od ${company.name}`,
    html,
    priority: 2,
    templateType: "invoice_send",
    referenceId: invoice.id,
    referenceType: "invoice",
  })
}

/**
 * Send payment reminder email to customer.
 */
export async function sendReminderEmail(params: {
  invoice: {
    id: string
    number: string
    total: number
    currency?: string
    issue_date: string
    due_date: string
    customer_name?: string
    contact?: { name: string; email?: string }
  }
  company: CompanyInfo
  recipientEmail: string
  daysOverdue: number
  level: number
}): Promise<string> {
  const { invoice, company, recipientEmail, daysOverdue } = params

  const html = reminderEmailTemplate(invoice, {
    name: company.name,
    email: company.email,
    phone: company.phone,
  }, daysOverdue)

  return queueEmail({
    companyId: company.id,
    to: recipientEmail,
    subject: `Upomienka - Faktúra č. ${invoice.number} (${daysOverdue} dní po splatnosti)`,
    html,
    priority: 3,
    templateType: "reminder",
    referenceId: invoice.id,
    referenceType: "invoice",
    metadata: { level: params.level, daysOverdue },
  })
}

/**
 * Send payment confirmation to customer.
 */
export async function sendPaymentConfirmationEmail(params: {
  invoice: {
    id: string
    number: string
    total: number
    currency?: string
    issue_date: string
    due_date: string
    customer_name?: string
    contact?: { name: string; email?: string }
  }
  payment: {
    amount: number
    currency?: string
    paid_at: string
    payment_method?: string
  }
  company: CompanyInfo
  recipientEmail: string
}): Promise<string> {
  const { invoice, payment, company, recipientEmail } = params

  const html = paymentConfirmationTemplate(invoice, payment)

  return queueEmail({
    companyId: company.id,
    to: recipientEmail,
    subject: `Potvrdenie platby - Faktúra č. ${invoice.number}`,
    html,
    priority: 4,
    templateType: "payment_confirmation",
    referenceId: invoice.id,
    referenceType: "invoice",
  })
}

/**
 * Send portal access token email.
 */
export async function sendPortalTokenEmail(params: {
  companyId: string
  companyName: string
  recipientEmail: string
  token: string
}): Promise<string> {
  const { companyId, companyName, recipientEmail, token } = params

  const html = portalTokenTemplate(token, companyName)

  return queueEmail({
    companyId,
    to: recipientEmail,
    subject: `Prístupový kód do portálu - ${companyName}`,
    html,
    priority: 1, // Highest priority - time-sensitive
    templateType: "portal_token",
  })
}

/**
 * Check notification rules and send email if email channel is enabled.
 * Called by the notification service after creating an in-app notification.
 */
export async function checkAndSendNotificationEmail(
  supabase: SupabaseClient,
  companyId: string,
  type: NotificationType,
  data: Record<string, any>
): Promise<void> {
  // Get notification rules for this type
  const { data: rules } = await (supabase.from("notification_rules") as any)
    .select("*")
    .eq("company_id", companyId)
    .eq("type", type)
    .limit(1)

  const rule = rules?.[0]

  // If no rule or email not enabled, skip
  if (!rule || !rule.channels?.email) return

  // Get company info
  const { data: company } = await (supabase.from("companies") as any)
    .select("id, name, email, phone")
    .eq("id", companyId)
    .single()

  if (!company) return

  // Get target users based on recipients setting
  let userQuery = (supabase.from("user_company_roles") as any)
    .select("user_id, profiles:user_id(email)")
    .eq("company_id", companyId)

  if (rule.recipients === "admin") {
    userQuery = userQuery.eq("role", "admin")
  } else if (rule.recipients === "uctovnik") {
    userQuery = userQuery.in("role", ["admin", "uctovnik"])
  }

  const { data: users } = await userQuery

  if (!users) return

  for (const user of users) {
    const email = (user as any).profiles?.email
    if (!email) continue

    await sendNotificationEmail({
      companyId,
      companyName: company.name,
      type,
      recipientEmail: email,
      data,
    })
  }
}

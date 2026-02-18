import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email/send"

export interface QueueEmailOptions {
  companyId?: string
  to: string
  from?: string
  subject: string
  html: string
  attachments?: Array<{ filename: string; url: string }>
  priority?: number // 1-10, 1 = highest
  templateType?: string
  referenceId?: string
  referenceType?: string
  metadata?: Record<string, unknown>
  scheduledFor?: Date
}

/**
 * Add an email to the queue for reliable delivery
 */
export async function queueEmail(options: QueueEmailOptions): Promise<string> {
  const db = createAdminClient()

  const { data, error } = await (db.from("email_queue") as any)
    .insert({
      company_id: options.companyId || null,
      to_email: options.to,
      from_email: options.from || null,
      subject: options.subject,
      html_body: options.html,
      attachments: options.attachments || [],
      priority: options.priority || 5,
      template_type: options.templateType || null,
      reference_id: options.referenceId || null,
      reference_type: options.referenceType || null,
      metadata: options.metadata || {},
      scheduled_for: options.scheduledFor?.toISOString() || new Date().toISOString(),
      status: "pending",
      attempts: 0,
      max_attempts: 3,
    })
    .select("id")
    .single()

  if (error) {
    throw new Error(`Chyba pri zaradení emailu do fronty: ${error.message}`)
  }

  return data.id
}

/**
 * Queue multiple emails at once (batch)
 */
export async function queueEmailBatch(emails: QueueEmailOptions[]): Promise<string[]> {
  const db = createAdminClient()

  const rows = emails.map((options) => ({
    company_id: options.companyId || null,
    to_email: options.to,
    from_email: options.from || null,
    subject: options.subject,
    html_body: options.html,
    attachments: options.attachments || [],
    priority: options.priority || 5,
    template_type: options.templateType || null,
    reference_id: options.referenceId || null,
    reference_type: options.referenceType || null,
    metadata: options.metadata || {},
    scheduled_for: options.scheduledFor?.toISOString() || new Date().toISOString(),
    status: "pending",
    attempts: 0,
    max_attempts: 3,
  }))

  const { data, error } = await (db.from("email_queue") as any)
    .insert(rows)
    .select("id")

  if (error) {
    throw new Error(`Chyba pri hromadnom zaradení emailov: ${error.message}`)
  }

  return (data || []).map((d: any) => d.id)
}

/**
 * Process pending emails from the queue (called by cron)
 * Returns number of emails processed
 */
export async function processEmailQueue(batchSize: number = 10): Promise<{
  processed: number
  sent: number
  failed: number
  errors: string[]
}> {
  const db = createAdminClient()
  const now = new Date().toISOString()
  const result = { processed: 0, sent: 0, failed: 0, errors: [] as string[] }

  // Fetch pending emails ready to send (scheduled_for <= now)
  // Also fetch failed emails that are ready for retry
  const { data: emails, error: fetchError } = await (db.from("email_queue") as any)
    .select("*")
    .or(`and(status.eq.pending,scheduled_for.lte.${now}),and(status.eq.failed,attempts.lt.max_attempts,next_retry_at.lte.${now})`)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(batchSize)

  if (fetchError || !emails || emails.length === 0) {
    return result
  }

  for (const email of emails) {
    result.processed++

    // Mark as processing
    await (db.from("email_queue") as any)
      .update({ status: "processing", updated_at: now })
      .eq("id", email.id)

    try {
      const sendResult = await sendEmail({
        to: email.to_email,
        subject: email.subject,
        html: email.html_body,
        from: email.from_email || undefined,
      })

      if (sendResult.success) {
        // Mark as sent
        await (db.from("email_queue") as any)
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            resend_id: (sendResult as any).data?.id || null,
            attempts: email.attempts + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id)

        // Log successful send
        await (db.from("email_log") as any).insert({
          company_id: email.company_id,
          queue_id: email.id,
          to_email: email.to_email,
          from_email: email.from_email,
          subject: email.subject,
          status: "sent",
          resend_id: (sendResult as any).data?.id || null,
          template_type: email.template_type,
          reference_id: email.reference_id,
          reference_type: email.reference_type,
          metadata: email.metadata,
        })

        result.sent++
      } else {
        throw new Error((sendResult as any).error?.message || "Unknown send error")
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Neznáma chyba"
      const newAttempts = email.attempts + 1
      const isFinalFailure = newAttempts >= email.max_attempts

      // Exponential backoff: 1min, 5min, 25min
      const retryDelayMs = Math.pow(5, newAttempts) * 60 * 1000
      const nextRetry = new Date(Date.now() + retryDelayMs)

      await (db.from("email_queue") as any)
        .update({
          status: isFinalFailure ? "failed" : "failed",
          attempts: newAttempts,
          last_error: errorMessage,
          next_retry_at: isFinalFailure ? null : nextRetry.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", email.id)

      // Log failure
      await (db.from("email_log") as any).insert({
        company_id: email.company_id,
        queue_id: email.id,
        to_email: email.to_email,
        from_email: email.from_email,
        subject: email.subject,
        status: "failed",
        template_type: email.template_type,
        reference_id: email.reference_id,
        reference_type: email.reference_type,
        error_message: errorMessage,
        metadata: email.metadata,
      })

      result.failed++
      result.errors.push(`${email.to_email}: ${errorMessage}`)
    }
  }

  return result
}

/**
 * Cancel a pending email
 */
export async function cancelQueuedEmail(emailId: string): Promise<boolean> {
  const db = createAdminClient()

  const { error } = await (db.from("email_queue") as any)
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", emailId)
    .in("status", ["pending"])

  return !error
}

/**
 * Get queue statistics for a company
 */
export async function getQueueStats(companyId: string): Promise<{
  pending: number
  processing: number
  sent: number
  failed: number
}> {
  const db = createAdminClient()

  const stats = { pending: 0, processing: 0, sent: 0, failed: 0 }

  for (const status of ["pending", "processing", "sent", "failed"] as const) {
    const { count } = await (db.from("email_queue") as any)
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", status)

    stats[status] = count ?? 0
  }

  return stats
}

/**
 * Clean up old sent/cancelled emails from queue (keep logs)
 */
export async function cleanupQueue(olderThanDays: number = 30): Promise<number> {
  const db = createAdminClient()
  const cutoffDate = new Date(Date.now() - olderThanDays * 86400000).toISOString()

  const { data } = await (db.from("email_queue") as any)
    .delete()
    .in("status", ["sent", "cancelled"])
    .lt("updated_at", cutoffDate)
    .select("id")

  return data?.length ?? 0
}

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

function calculateNextDate(currentDate: string, interval: string): string {
  const date = new Date(currentDate)
  switch (interval) {
    case "monthly":
      date.setMonth(date.getMonth() + 1)
      break
    case "quarterly":
      date.setMonth(date.getMonth() + 3)
      break
    case "annually":
      date.setFullYear(date.getFullYear() + 1)
      break
    case "weekly":
      date.setDate(date.getDate() + 7)
      break
  }
  return date.toISOString().split("T")[0]
}

/**
 * POST /api/cron/recurring-invoices
 * Auto-generate invoices from active recurring templates where next_generation_date <= today.
 * Called daily by Vercel Cron.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()
  const today = new Date().toISOString().split("T")[0]

  // Find all active recurring invoices due for generation
  const { data: templates, error: fetchError } = await (db
    .from("recurring_invoices") as any)
    .select(`
      *,
      contact:contacts(id, name, ico, dic, ic_dph, street, city, zip, country)
    `)
    .eq("is_active", true)
    .lte("next_generation_date", today)
    .is("deleted_at", null)

  if (fetchError || !templates) {
    return NextResponse.json({ error: fetchError?.message || "Chyba" }, { status: 500 })
  }

  let generated = 0
  let errors = 0
  const errorDetails: string[] = []

  for (const template of templates) {
    try {
      // Check end_date if set
      if (template.end_date && template.end_date < today) {
        // Deactivate expired recurring
        await (db.from("recurring_invoices") as any)
          .update({ is_active: false })
          .eq("id", template.id)
        continue
      }

      // Parse items
      let items = template.items
      if (typeof items === "string") items = JSON.parse(items)
      if (!items || !Array.isArray(items) || items.length === 0) continue

      // Generate invoice number
      const sequenceType = template.type === "prijata" ? "faktura_prijata" : "faktura_vydana"
      const { data: invoiceNumber, error: numError } = await (db.rpc as any)(
        "generate_next_number",
        { p_company_id: template.company_id, p_type: sequenceType }
      )

      if (numError) throw new Error(numError.message)

      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + (template.payment_days || 14))

      // Create invoice
      const { data: invoice, error: createError } = await (db
        .from("invoices") as any)
        .insert({
          company_id: template.company_id,
          type: template.type,
          number: invoiceNumber,
          contact_id: template.contact_id || null,
          issue_date: today,
          delivery_date: today,
          due_date: dueDate.toISOString().split("T")[0],
          currency: template.currency || "EUR",
          exchange_rate: template.exchange_rate || 1,
          variable_symbol: template.variable_symbol || null,
          constant_symbol: template.constant_symbol || null,
          specific_symbol: template.specific_symbol || null,
          reverse_charge: template.reverse_charge || false,
          notes: template.notes || null,
          status: "draft",
        })
        .select("id")
        .single()

      if (createError) throw new Error(createError.message)

      // Create items
      const invoiceItems = items.map((item: any, index: number) => ({
        company_id: template.company_id,
        invoice_id: invoice.id,
        position: index,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate,
      }))

      await (db.from("invoice_items") as any).insert(invoiceItems)

      // Update recurring template
      const nextDate = calculateNextDate(template.next_generation_date, template.interval)
      await (db.from("recurring_invoices") as any)
        .update({
          last_generation_date: today,
          next_generation_date: nextDate,
        })
        .eq("id", template.id)

      // Create notification
      await (db.from("notifications") as any).insert({
        company_id: template.company_id,
        type: "invoice_approved",
        title: "Opakovaná faktúra vygenerovaná",
        message: `Faktúra ${invoiceNumber} bola automaticky vygenerovaná z opakovanej šablóny.`,
        link: `/invoices`,
      })

      generated++
    } catch (err) {
      errors++
      const msg = err instanceof Error ? err.message : "Neznáma chyba"
      errorDetails.push(`Template ${template.id}: ${msg}`)
      console.error(`[CRON] Recurring invoice error for ${template.id}:`, msg)
    }
  }

  return NextResponse.json({
    success: true,
    templates_checked: templates.length,
    generated,
    errors,
    errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
  })
}

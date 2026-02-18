import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * POST /api/cron/bank-auto-match
 * Automatically match unmatched bank transactions with invoices.
 * Called every 6 hours by Vercel Cron.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()

  // Get all companies
  const { data: companies } = await (db.from("companies") as any)
    .select("id, name")
    .is("deleted_at", null)

  if (!companies) {
    return NextResponse.json({ success: true, matched: 0 })
  }

  let totalMatched = 0
  const errors: string[] = []

  for (const company of companies) {
    try {
      // Get unmatched incoming transactions
      const { data: transactions } = await (db.from("bank_transactions") as any)
        .select("id, amount, variable_symbol, reference, counterparty_name, counterparty_iban")
        .eq("company_id", company.id)
        .is("invoice_id", null)
        .eq("type", "credit") // incoming payments
        .is("deleted_at", null)
        .limit(100)

      if (!transactions || transactions.length === 0) continue

      // Get matching rules for this company
      const { data: rules } = await (db.from("bank_matching_rules") as any)
        .select("*")
        .eq("company_id", company.id)
        .eq("is_active", true)
        .order("priority", { ascending: true })

      for (const tx of transactions) {
        let matched = false

        // Try matching by variable symbol first (most reliable)
        if (tx.variable_symbol) {
          const { data: invoices } = await (db.from("invoices") as any)
            .select("id, number, total_amount, paid_amount, status")
            .eq("company_id", company.id)
            .eq("variable_symbol", tx.variable_symbol)
            .in("status", ["odoslana", "ciastocne_uhradena", "po_splatnosti"])
            .is("deleted_at", null)
            .limit(1)

          if (invoices && invoices.length > 0) {
            const invoice = invoices[0]
            const remaining = (invoice.total_amount || 0) - (invoice.paid_amount || 0)

            // Match if amount is close (within 0.01 tolerance)
            if (Math.abs(tx.amount - remaining) < 0.01) {
              await (db.from("bank_transactions") as any)
                .update({ invoice_id: invoice.id, matched_at: new Date().toISOString() })
                .eq("id", tx.id)

              // Update invoice payment
              const newPaidAmount = (invoice.paid_amount || 0) + tx.amount
              const newStatus = newPaidAmount >= (invoice.total_amount || 0) ? "uhradena" : "ciastocne_uhradena"

              await (db.from("invoices") as any)
                .update({ paid_amount: newPaidAmount, status: newStatus })
                .eq("id", invoice.id)

              totalMatched++
              matched = true
            }
          }
        }

        // Try custom rules if no match found
        if (!matched && rules) {
          for (const rule of rules) {
            const conditions = rule.conditions || {}
            let ruleMatched = true

            if (conditions.counterparty_name && tx.counterparty_name) {
              if (!tx.counterparty_name.toLowerCase().includes(conditions.counterparty_name.toLowerCase())) {
                ruleMatched = false
              }
            }

            if (conditions.counterparty_iban && tx.counterparty_iban) {
              if (tx.counterparty_iban !== conditions.counterparty_iban) {
                ruleMatched = false
              }
            }

            if (conditions.min_amount && tx.amount < conditions.min_amount) {
              ruleMatched = false
            }

            if (conditions.max_amount && tx.amount > conditions.max_amount) {
              ruleMatched = false
            }

            if (ruleMatched && rule.action_invoice_id) {
              await (db.from("bank_transactions") as any)
                .update({
                  invoice_id: rule.action_invoice_id,
                  matched_at: new Date().toISOString(),
                  matched_by_rule: rule.id,
                })
                .eq("id", tx.id)

              totalMatched++
              break
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Neznáma chyba"
      errors.push(`${company.name}: ${msg}`)
    }
  }

  return NextResponse.json({
    success: true,
    companies_checked: companies.length,
    matched: totalMatched,
    errors: errors.length > 0 ? errors : undefined,
  })
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  fetchECBRates,
  revalueOpenItems,
  type OpenItem,
} from "@/lib/currency/multi-currency"

// POST /api/currency/revaluation
// Run year-end revaluation of open foreign currency items
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  try {
    const body = await request.json()
    const { company_id, date, confirm } = body

    if (!company_id || !date) {
      return NextResponse.json(
        { error: "company_id a date su povinne" },
        { status: 400 }
      )
    }

    // Validate date format (should be 31.12.YYYY or YYYY-12-31)
    const normalizedDate = date.includes(".")
      ? (() => {
          const parts = date.split(".")
          return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
        })()
      : date

    if (!normalizedDate.endsWith("-12-31") && !normalizedDate.match(/^\d{4}-12-31$/)) {
      // Allow any date for flexibility, but warn
    }

    // Verify user access
    const { data: companyAccess } = await (db.from("user_company_roles") as any)
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .single() as { data: any; error: any }

    if (!companyAccess) {
      return NextResponse.json({ error: "Nemate pristup k tejto spolocnosti" }, { status: 403 })
    }

    // Get closing rates for the date
    const ecbRates = await fetchECBRates(normalizedDate)
    const closingRates: Record<string, number> = {}
    for (const rate of ecbRates) {
      closingRates[rate.currency_to] = rate.rate
    }

    // Also try database rates
    const { data: dbRates } = await (db.from("exchange_rates") as any)
      .select("currency_to, rate")
      .eq("company_id", company_id)
      .eq("date", normalizedDate)
      .eq("currency_from", "EUR")

    if (dbRates && Array.isArray(dbRates)) {
      for (const r of dbRates) {
        closingRates[r.currency_to] = r.rate // DB rates override simulated
      }
    }

    // Find open receivables (invoices not fully paid, in foreign currency)
    const { data: openReceivables } = await (db.from("invoices") as any)
      .select(`
        id, number, currency, total_with_vat, exchange_rate,
        issue_date, due_date, type,
        contact:contacts (name)
      `)
      .eq("company_id", company_id)
      .neq("currency", "EUR")
      .in("status", ["sent", "overdue", "partial"])
      .is("deleted_at", null)
      .lte("issue_date", normalizedDate)

    // Find open payables
    const { data: openPayables } = await (db.from("invoices") as any)
      .select(`
        id, number, currency, total_with_vat, exchange_rate,
        issue_date, due_date, type,
        contact:contacts (name)
      `)
      .eq("company_id", company_id)
      .eq("type", "received")
      .neq("currency", "EUR")
      .in("status", ["sent", "overdue", "partial"])
      .is("deleted_at", null)
      .lte("issue_date", normalizedDate)

    // Build open items list
    const openItems: OpenItem[] = []

    if (openReceivables) {
      for (const inv of openReceivables) {
        if (inv.type === "received") continue // Skip, handled by payables
        const exchangeRate = inv.exchange_rate || 1
        openItems.push({
          id: inv.id,
          type: "receivable",
          contact_name: inv.contact?.name || "Neznamy",
          invoice_number: inv.number || inv.id,
          currency: inv.currency,
          foreign_amount: inv.total_with_vat,
          original_rate: exchangeRate,
          original_eur_amount: Math.round((inv.total_with_vat / exchangeRate) * 100) / 100,
          date: inv.issue_date,
          due_date: inv.due_date,
        })
      }
    }

    if (openPayables) {
      for (const inv of openPayables) {
        const exchangeRate = inv.exchange_rate || 1
        openItems.push({
          id: inv.id,
          type: "payable",
          contact_name: inv.contact?.name || "Neznamy",
          invoice_number: inv.number || inv.id,
          currency: inv.currency,
          foreign_amount: inv.total_with_vat,
          original_rate: exchangeRate,
          original_eur_amount: Math.round((inv.total_with_vat / exchangeRate) * 100) / 100,
          date: inv.issue_date,
          due_date: inv.due_date,
        })
      }
    }

    // Calculate revaluation
    const results = revalueOpenItems(openItems, closingRates, normalizedDate)

    // If confirm=true, create journal entries
    if (confirm && results.length > 0) {
      const entriesToInsert = results.map((r) => ({
        company_id,
        date: normalizedDate,
        description: r.entry.description,
        debit_account: r.entry.debit_account,
        credit_account: r.entry.credit_account,
        amount: r.entry.amount,
        document_type: "precenenie",
        status: "posted",
        created_by: user.id,
      }))

      const { data: insertedEntries, error: insertError } = await (db.from("journal_entries") as any)
        .insert(entriesToInsert)
        .select("id")

      if (insertError) {
        return NextResponse.json(
          { error: `Chyba pri ukladani uctovnych zapisov: ${insertError.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        date: normalizedDate,
        items_count: openItems.length,
        revaluation_count: results.length,
        total_gain: results
          .filter((r) => r.type === "kurzovy_zisk")
          .reduce((sum, r) => sum + Math.abs(r.difference), 0),
        total_loss: results
          .filter((r) => r.type === "kurzova_strata")
          .reduce((sum, r) => sum + Math.abs(r.difference), 0),
        entries_created: insertedEntries?.length || 0,
        results: results.map((r) => ({
          invoice_number: r.item.invoice_number,
          contact_name: r.item.contact_name,
          type: r.item.type,
          currency: r.item.currency,
          foreign_amount: r.item.foreign_amount,
          original_rate: r.item.original_rate,
          closing_rate: r.closingRate,
          original_eur: r.item.original_eur_amount,
          new_eur: r.newEurAmount,
          difference: r.difference,
          result_type: r.type,
          entry: r.entry,
        })),
      })
    }

    // Preview mode (no confirm)
    return NextResponse.json({
      preview: true,
      date: normalizedDate,
      closing_rates: closingRates,
      items_count: openItems.length,
      revaluation_count: results.length,
      total_gain: results
        .filter((r) => r.type === "kurzovy_zisk")
        .reduce((sum, r) => sum + Math.abs(r.difference), 0),
      total_loss: results
        .filter((r) => r.type === "kurzova_strata")
        .reduce((sum, r) => sum + Math.abs(r.difference), 0),
      open_items: openItems,
      results: results.map((r) => ({
        invoice_number: r.item.invoice_number,
        contact_name: r.item.contact_name,
        type: r.item.type,
        currency: r.item.currency,
        foreign_amount: r.item.foreign_amount,
        original_rate: r.item.original_rate,
        closing_rate: r.closingRate,
        original_eur: r.item.original_eur_amount,
        new_eur: r.newEurAmount,
        difference: r.difference,
        result_type: r.type,
        entry: r.entry,
      })),
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: `Chyba pri preceneni: ${err.message || "unknown"}` },
      { status: 500 }
    )
  }
}

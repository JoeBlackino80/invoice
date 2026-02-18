import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchECBRates } from "@/lib/currency/multi-currency"

// GET /api/currency/rates
// Get exchange rates (latest or for specific date)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")
  const currency = searchParams.get("currency")
  const companyId = searchParams.get("company_id")

  // Try to fetch from database first
  if (companyId) {
    let query = (db.from("exchange_rates") as any)
      .select("*")
      .eq("company_id", companyId)

    if (date) {
      query = query.eq("date", date)
    }
    if (currency && currency !== "all") {
      query = query.eq("currency_to", currency)
    }

    const { data, error } = await query.order("date", { ascending: false }).limit(100)

    if (!error && data && data.length > 0) {
      return NextResponse.json(data)
    }
  }

  // Fallback: fetch real ECB rates
  const rates = await fetchECBRates(date || undefined)

  // Filter by currency if specified
  if (currency && currency !== "all") {
    const filtered = rates.filter((r) => r.currency_to === currency)
    return NextResponse.json(filtered)
  }

  return NextResponse.json(rates)
}

// POST /api/currency/rates
// Fetch fresh rates from ECB and store them
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  try {
    const body = await request.json()
    const { company_id, date } = body

    if (!company_id) {
      return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
    }

    const rateDate = date || new Date().toISOString().split("T")[0]
    const rates = await fetchECBRates(rateDate)

    // Store rates in database
    const ratesToInsert = rates.map((rate) => ({
      company_id,
      currency_from: rate.currency_from,
      currency_to: rate.currency_to,
      rate: rate.rate,
      date: rate.date,
      source: rate.source,
    }))

    // Upsert - update if exists for same date/currency pair
    for (const rateData of ratesToInsert) {
      await (db.from("exchange_rates") as any)
        .upsert(rateData, {
          onConflict: "company_id,currency_from,currency_to,date",
          ignoreDuplicates: false,
        })
    }

    return NextResponse.json({
      success: true,
      count: rates.length,
      date: rateDate,
      rates,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: `Chyba pri aktualizacii kurzov: ${err.message || "unknown"}` },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  convertAmount,
  fetchECBRates,
  SUPPORTED_CURRENCIES,
} from "@/lib/currency/multi-currency"

// POST /api/currency/convert
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  try {
    const body = await request.json()
    const { amount, from, to, date, company_id } = body

    if (amount === undefined || !from || !to) {
      return NextResponse.json(
        { error: "amount, from a to su povinne" },
        { status: 400 }
      )
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount)) {
      return NextResponse.json({ error: "Neplatna suma" }, { status: 400 })
    }

    // Validate currencies
    const validCodes = SUPPORTED_CURRENCIES.map((c) => c.code)
    if (!validCodes.includes(from) || !validCodes.includes(to)) {
      return NextResponse.json({ error: "Nepodporovana mena" }, { status: 400 })
    }

    if (from === to) {
      return NextResponse.json({
        amount: numAmount,
        from,
        to,
        result: numAmount,
        rate: 1,
        date: date || new Date().toISOString().split("T")[0],
      })
    }

    // Try to get rate from database
    let rate: number | null = null

    if (company_id) {
      const rateDate = date || new Date().toISOString().split("T")[0]

      if (from === "EUR") {
        const { data: rateData } = await (db.from("exchange_rates") as any)
          .select("rate")
          .eq("company_id", company_id)
          .eq("currency_from", "EUR")
          .eq("currency_to", to)
          .eq("date", rateDate)
          .single() as { data: any; error: any }

        if (rateData) rate = rateData.rate
      } else if (to === "EUR") {
        const { data: rateData } = await (db.from("exchange_rates") as any)
          .select("rate")
          .eq("company_id", company_id)
          .eq("currency_from", "EUR")
          .eq("currency_to", from)
          .eq("date", rateDate)
          .single() as { data: any; error: any }

        if (rateData) rate = rateData.rate
      }
    }

    // Fallback to simulated ECB rates
    if (rate === null) {
      const rates = await fetchECBRates(date || undefined)

      if (from === "EUR") {
        const found = rates.find((r) => r.currency_to === to)
        rate = found ? found.rate : null
      } else if (to === "EUR") {
        const found = rates.find((r) => r.currency_to === from)
        rate = found ? found.rate : null
      } else {
        // Cross-rate: both non-EUR
        const fromRate = rates.find((r) => r.currency_to === from)
        const toRate = rates.find((r) => r.currency_to === to)
        if (fromRate && toRate) {
          // from -> EUR -> to
          const eurAmount = numAmount / fromRate.rate
          const result = Math.round(eurAmount * toRate.rate * 100) / 100
          return NextResponse.json({
            amount: numAmount,
            from,
            to,
            result,
            rate_from_eur: fromRate.rate,
            rate_to_eur: toRate.rate,
            cross_rate: toRate.rate / fromRate.rate,
            date: date || new Date().toISOString().split("T")[0],
          })
        }
      }
    }

    if (rate === null) {
      return NextResponse.json({ error: "Kurz pre tento menovy par nie je dostupny" }, { status: 404 })
    }

    const result = convertAmount(numAmount, from, to, rate)

    return NextResponse.json({
      amount: numAmount,
      from,
      to,
      result,
      rate,
      date: date || new Date().toISOString().split("T")[0],
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: `Chyba pri konverzii: ${err.message || "unknown"}` },
      { status: 500 }
    )
  }
}

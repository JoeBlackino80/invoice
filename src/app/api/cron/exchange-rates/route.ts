import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * POST /api/cron/exchange-rates
 * Fetch daily exchange rates from ECB and update the database.
 * Called daily by Vercel Cron at 16:00 CET (ECB publishes around 16:00).
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Fetch rates from ECB
    const ecbUrl = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
    const response = await fetch(ecbUrl, { next: { revalidate: 0 } })

    if (!response.ok) {
      throw new Error(`ECB API returned ${response.status}`)
    }

    const xmlText = await response.text()

    // Parse exchange rates from XML
    const rates: Record<string, number> = {}
    const rateRegex = /currency='([A-Z]{3})'\s+rate='([\d.]+)'/g
    let match
    while ((match = rateRegex.exec(xmlText)) !== null) {
      rates[match[1]] = parseFloat(match[2])
    }

    // Extract date
    const dateMatch = xmlText.match(/time='(\d{4}-\d{2}-\d{2})'/)
    const rateDate = dateMatch ? dateMatch[1] : new Date().toISOString().split("T")[0]

    if (Object.keys(rates).length === 0) {
      return NextResponse.json({ error: "Nepodarilo sa spracovať kurzy ECB" }, { status: 500 })
    }

    const db = createAdminClient()

    // Store rates - upsert for each currency
    const rows = Object.entries(rates).map(([currency, rate]) => ({
      currency_code: currency,
      rate_to_eur: rate,
      rate_date: rateDate,
      source: "ECB",
    }))

    const { error: upsertError } = await (db.from("exchange_rates") as any)
      .upsert(rows, { onConflict: "currency_code,rate_date" })

    if (upsertError) {
      throw new Error(upsertError.message)
    }

    // Also try NBS for additional currencies
    let nbsRatesCount = 0
    try {
      const nbsUrl = `https://nbs.sk/export/sk/exchange-rate/${rateDate}/csv`
      const nbsResp = await fetch(nbsUrl, { next: { revalidate: 0 } })
      if (nbsResp.ok) {
        const nbsText = await nbsResp.text()
        const lines = nbsText.split("\n").filter((l) => l.trim())
        for (const line of lines.slice(1)) {
          // NBS CSV: date;currency;amount;code;rate
          const parts = line.split(";")
          if (parts.length >= 5) {
            const code = parts[3]?.trim()
            const amount = parseFloat(parts[2]) || 1
            const rate = parseFloat(parts[4]?.replace(",", ".")) || 0
            if (code && rate > 0 && !rates[code]) {
              await (db.from("exchange_rates") as any)
                .upsert({
                  currency_code: code,
                  rate_to_eur: rate / amount,
                  rate_date: rateDate,
                  source: "NBS",
                }, { onConflict: "currency_code,rate_date" })
              nbsRatesCount++
            }
          }
        }
      }
    } catch {
      // NBS is optional, don't fail if it's unavailable
    }

    return NextResponse.json({
      success: true,
      date: rateDate,
      ecb_rates: Object.keys(rates).length,
      nbs_additional: nbsRatesCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznáma chyba"
    console.error("[CRON] Exchange rates error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

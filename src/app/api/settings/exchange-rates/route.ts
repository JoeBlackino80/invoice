import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { exchangeRateSchema } from "@/lib/validations/settings"
import { fetchEcbRates } from "@/lib/exchange-rates"

// Country names for common currencies (Slovak)
const currencyCountryMap: Record<string, string> = {
  USD: "USA",
  GBP: "Veľká Británia",
  CZK: "Česko",
  HUF: "Maďarsko",
  PLN: "Poľsko",
  CHF: "Švajčiarsko",
  SEK: "Švédsko",
  NOK: "Nórsko",
  DKK: "Dánsko",
  RON: "Rumunsko",
  BGN: "Bulharsko",
  HRK: "Chorvátsko",
  JPY: "Japonsko",
  AUD: "Austrália",
  CAD: "Kanada",
  CNY: "Čína",
  TRY: "Turecko",
  BRL: "Brazília",
  INR: "India",
  RUB: "Rusko",
  KRW: "Južná Kórea",
}

// Fetch real ECB rates and format them
async function getEcbRates(): Promise<Array<{ currency_from: string; currency_to: string; rate: number; country: string }>> {
  const rates = await fetchEcbRates()
  return Object.entries(rates).map(([currency, rate]) => ({
    currency_from: "EUR",
    currency_to: currency,
    rate,
    country: currencyCountryMap[currency] || currency,
  }))
}

// GET /api/settings/exchange-rates
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const action = searchParams.get("action")
  const currency = searchParams.get("currency")
  const date = searchParams.get("date")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinne" }, { status: 400 })
  }

  // Verify user has access
  const { data: role, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .single() as { data: any; error: any }

  if (roleError || !role) {
    return NextResponse.json({ error: "Pristup zamietnuty" }, { status: 403 })
  }

  // Fetch real ECB rates
  if (action === "fetch") {
    const ecbRates = await getEcbRates()
    const today = new Date().toISOString().split("T")[0]

    // Upsert rates into database
    for (const rate of ecbRates) {
      await (db
        .from("exchange_rates") as any)
        .upsert({
          company_id: companyId,
          currency_from: rate.currency_from,
          currency_to: rate.currency_to,
          rate: rate.rate,
          date: today,
          source: "ECB",
        }, {
          onConflict: "company_id,currency_from,currency_to,date",
        })
    }

    return NextResponse.json({
      message: "Kurzy boli aktualizovane",
      rates: ecbRates.map((r) => ({ ...r, date: today, source: "ECB" })),
    })
  }

  // List exchange rates
  let query = (db
    .from("exchange_rates") as any)
    .select("*")
    .eq("company_id", companyId)

  if (currency) {
    query = query.eq("currency_to", currency)
  }

  if (date) {
    query = query.eq("date", date)
  } else {
    // Return latest rates - order by date descending and get the most recent
    query = query.order("date", { ascending: false }).limit(50)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

// POST /api/settings/exchange-rates - Manually add/update exchange rate
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...rateData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinne" }, { status: 400 })
  }

  // Verify user has write access
  const { data: role, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", company_id)
    .single() as { data: any; error: any }

  if (roleError || !role || !["admin", "uctovnik"].includes(role.role)) {
    return NextResponse.json({ error: "Pristup zamietnuty" }, { status: 403 })
  }

  const parsed = exchangeRateSchema.safeParse(rateData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await (db
    .from("exchange_rates") as any)
    .upsert({
      company_id,
      currency_from: parsed.data.currency_from,
      currency_to: parsed.data.currency_to,
      rate: parsed.data.rate,
      date: parsed.data.date,
      source: "manual",
      created_by: user.id,
    }, {
      onConflict: "company_id,currency_from,currency_to,date",
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

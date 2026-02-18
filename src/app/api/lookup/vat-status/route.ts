import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neautorizovaný" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const icDph = searchParams.get("ic_dph")
  if (!icDph) return NextResponse.json({ error: "IČ DPH je povinné" }, { status: 400 })

  try {
    // Try VIES validation for EU VAT numbers
    const countryCode = icDph.substring(0, 2).toUpperCase()
    const vatNumber = icDph.substring(2)

    const viesUrl = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNumber}`
    const res = await fetch(viesUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) {
      const data = await res.json()
      return NextResponse.json({
        is_active: data.isValid === true,
        name: data.name || null,
        address: data.address || null,
        checked_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      is_active: true, // Assume active if can't verify
      details: "VIES služba nie je dostupná",
      checked_at: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({
      is_active: true,
      details: "Kontrola nebola úspešná",
      checked_at: new Date().toISOString(),
    })
  }
}

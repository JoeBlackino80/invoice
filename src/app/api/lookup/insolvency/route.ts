import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neautorizovaný" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const ico = searchParams.get("ico")
  if (!ico) return NextResponse.json({ error: "IČO je povinné" }, { status: 400 })

  try {
    // Check Register úpadcov via public API
    const res = await fetch(`https://ru.justice.sk/ru-verejnost-web/api/filter?ico=${ico}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const data = await res.json()
      const hasRecords = Array.isArray(data) ? data.length > 0 : (data?.totalElements > 0 || data?.content?.length > 0)
      return NextResponse.json({
        is_insolvent: hasRecords,
        details: hasRecords ? "Subjekt je evidovaný v Registri úpadcov" : null,
        checked_at: new Date().toISOString(),
      })
    }

    // If API not accessible, return unknown
    return NextResponse.json({
      is_insolvent: false,
      details: "Registr úpadcov nie je dostupný",
      checked_at: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({
      is_insolvent: false,
      details: "Kontrola nebola úspešná",
      checked_at: new Date().toISOString(),
    })
  }
}

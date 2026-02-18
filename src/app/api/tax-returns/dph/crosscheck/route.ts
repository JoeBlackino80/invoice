import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { crosscheckDPHvsAccount343 } from "@/lib/tax/dph-crosscheck"

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neautorizovaný" }, { status: 401 })

  const body = await request.json()
  const { company_id, period_from, period_to } = body

  if (!company_id || !period_from || !period_to) {
    return NextResponse.json({ error: "Chýbajú parametre" }, { status: 400 })
  }

  const db = createAdminClient()
  const result = await crosscheckDPHvsAccount343(company_id, db, period_from, period_to)

  return NextResponse.json(result)
}

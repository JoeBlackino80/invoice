import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/companies - get current user's companies
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { data, error } = await (db
    .from("user_company_roles") as any)
    .select(`
      id,
      company_id,
      role,
      is_default,
      company:companies (
        id,
        name,
        ico,
        dic,
        ic_dph,
        business_type,
        accounting_type,
        is_vat_payer,
        logo_url
      )
    `)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

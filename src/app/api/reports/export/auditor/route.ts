import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateAuditorPackage } from "@/lib/reports/export-generator"

// POST /api/reports/export/auditor - Generate auditor export package
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, fiscal_year_id, sections } = body

  if (!company_id) {
    return NextResponse.json(
      { error: "company_id je povinny" },
      { status: 400 }
    )
  }

  if (!fiscal_year_id) {
    return NextResponse.json(
      { error: "fiscal_year_id je povinny" },
      { status: 400 }
    )
  }

  try {
    const packageData = await generateAuditorPackage(
      company_id,
      fiscal_year_id, db)

    // Filter sections if specific sections were requested
    if (sections && Array.isArray(sections) && sections.length > 0) {
      packageData.sections = packageData.sections.filter((s) =>
        sections.includes(s.key)
      )
    }

    return NextResponse.json(packageData)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Chyba pri generovani auditorského balika" },
      { status: 500 }
    )
  }
}

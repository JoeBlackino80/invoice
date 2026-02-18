import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getArchiveStatus,
  archiveClosedPeriod,
  checkExpiringArchives,
} from "@/lib/audit/archive-manager"
import { logAction } from "@/lib/audit/audit-logger"

// GET /api/settings/archive - Stav archivacie / blizace sa expiracie
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

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (action === "expiring") {
    const expiring = await checkExpiringArchives(db, companyId)
    return NextResponse.json({ data: expiring })
  }

  // Standardny stav archivacie
  const status = await getArchiveStatus(db, companyId)
  return NextResponse.json({ data: status })
}

// POST /api/settings/archive - Archivacia uzavreteho obdobia
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, action, period_end } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (action !== "archive") {
    return NextResponse.json({ error: "Neplatna akcia" }, { status: 400 })
  }

  if (!period_end) {
    return NextResponse.json({ error: "period_end je povinny" }, { status: 400 })
  }

  const result = await archiveClosedPeriod(db, company_id, period_end)

  // Zaznamenat do audit logu
  await logAction(db, {
    company_id,
    user_id: user.id,
    user_email: user.email || "",
    action: "create",
    entity_type: "archive",
    entity_id: period_end,
    old_values: null,
    new_values: {
      period_end,
      archived_count: result.archived_count,
      entity_types: result.entity_types,
    },
    ip_address: null,
    user_agent: null,
  })

  return NextResponse.json(result)
}

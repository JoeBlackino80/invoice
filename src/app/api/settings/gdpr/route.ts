import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  exportPersonalData,
  anonymizePersonalData,
  getProcessingRecords,
  checkRetentionCompliance,
} from "@/lib/audit/gdpr-manager"
import { logAction } from "@/lib/audit/audit-logger"

// GET /api/settings/gdpr - GDPR dashboard data
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const [processingRecords, retentionChecks] = await Promise.all([
    getProcessingRecords(db, companyId),
    checkRetentionCompliance(db, companyId),
  ])

  return NextResponse.json({
    data: {
      processing_records: processingRecords,
      retention_checks: retentionChecks,
    },
  })
}

// POST /api/settings/gdpr - GDPR akcia (export / anonymizacia)
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, action, person_type, person_id } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!action || !person_type || !person_id) {
    return NextResponse.json(
      { error: "action, person_type a person_id su povinne" },
      { status: 400 }
    )
  }

  if (!["export", "anonymize"].includes(action)) {
    return NextResponse.json({ error: "Neplatna akcia" }, { status: 400 })
  }

  if (!["employee", "contact"].includes(person_type)) {
    return NextResponse.json({ error: "Neplatny typ osoby" }, { status: 400 })
  }

  if (action === "export") {
    const exportData = await exportPersonalData(db, company_id, person_type, person_id)

    // Zaznamenat export do audit logu
    await logAction(db, {
      company_id,
      user_id: user.id,
      user_email: user.email || "",
      action: "export",
      entity_type: "gdpr",
      entity_id: person_id,
      old_values: null,
      new_values: {
        gdpr_action: "export",
        person_type,
        person_id,
      },
      ip_address: null,
      user_agent: null,
    })

    return NextResponse.json({ data: exportData })
  }

  if (action === "anonymize") {
    const result = await anonymizePersonalData(db, company_id, person_type, person_id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Zaznamenat anonymizaciu do audit logu
    await logAction(db, {
      company_id,
      user_id: user.id,
      user_email: user.email || "",
      action: "delete",
      entity_type: "gdpr",
      entity_id: person_id,
      old_values: {
        gdpr_action: "anonymize",
        person_type,
      },
      new_values: {
        anonymized_fields: result.anonymized_fields,
        preserved_records: result.preserved_records,
      },
      ip_address: null,
      user_agent: null,
    })

    return NextResponse.json({ data: result })
  }

  return NextResponse.json({ error: "Neplatna akcia" }, { status: 400 })
}

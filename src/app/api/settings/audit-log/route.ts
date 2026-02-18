import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getAuditLog,
  generateAuditReport,
  detectSuspiciousActivity,
  type AuditLogFilters,
  type AuditEntityType,
  type AuditAction,
} from "@/lib/audit/audit-logger"

// GET /api/settings/audit-log - Zoznam audit logov s filtrami
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

  // Kontrola akcie
  const actionParam = searchParams.get("action_type")

  if (actionParam === "suspicious") {
    // Detekcia podozrivej aktivity
    const suspicious = await detectSuspiciousActivity(db, companyId)
    return NextResponse.json({ data: suspicious })
  }

  // Standardne filtrovanie audit logu
  const filters: AuditLogFilters = {
    entity_type: (searchParams.get("entity_type") || undefined) as AuditEntityType | undefined,
    action: (searchParams.get("action") || undefined) as AuditAction | undefined,
    user_id: searchParams.get("user_id") || undefined,
    date_from: searchParams.get("date_from") || undefined,
    date_to: searchParams.get("date_to") || undefined,
    page: parseInt(searchParams.get("page") || "1"),
    limit: parseInt(searchParams.get("limit") || "50"),
  }

  const result = await getAuditLog(db, companyId, filters)

  return NextResponse.json({
    data: result.entries,
    pagination: {
      total: result.total,
      page: filters.page || 1,
      limit: filters.limit || 50,
      totalPages: Math.ceil(result.total / (filters.limit || 50)),
    },
  })
}

// POST /api/settings/audit-log - Export audit logu ako CSV
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, filters } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  // Nacitanie vsetkych zaznamov pre export (s vyssim limitom)
  const exportFilters: AuditLogFilters = {
    ...filters,
    page: 1,
    limit: 10000,
  }

  const result = await getAuditLog(db, company_id, exportFilters)
  const csv = generateAuditReport(result.entries)

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}

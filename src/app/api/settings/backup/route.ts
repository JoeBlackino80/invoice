import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAction } from "@/lib/audit/audit-logger"

// GET /api/settings/backup - Zoznam zalohovych exportov
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

  // Nacitanie predchadzajucich exportov z audit logu
  const { data: exports } = await (db.from("audit_log") as any)
    .select("*")
    .eq("company_id", companyId)
    .eq("table_name", "settings")
    .order("created_at", { ascending: false })
    .limit(20)

  const backupEntries = (exports || [])
    .filter((e: any) => e.new_values?._audit_action === "export" && e.new_values?.backup_type === "full")
    .map((e: any) => ({
      id: e.id,
      created_at: e.created_at,
      user_id: e.user_id,
      tables_exported: e.new_values?.tables_exported || 0,
      records_exported: e.new_values?.records_exported || 0,
      size_estimate: e.new_values?.size_estimate || "N/A",
    }))

  return NextResponse.json({ data: backupEntries })
}

// POST /api/settings/backup - Vytvorenie manuálnej zálohy
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  // Zber dat zo vsetkych tabuliek
  const tables = [
    "companies",
    "company_settings",
    "contacts",
    "invoices",
    "invoice_items",
    "journal_entries",
    "journal_entry_lines",
    "chart_of_accounts",
    "bank_accounts",
    "bank_transactions",
    "bank_statements",
    "cash_registers",
    "cash_transactions",
    "documents",
    "employees",
    "payroll_runs",
    "payslips",
    "fiscal_years",
    "number_sequences",
    "payment_orders",
    "quotes",
    "quote_items",
    "orders",
    "order_items",
    "recurring_invoices",
    "cost_centers",
    "projects",
    "assets",
    "predkontacie",
  ]

  const backupData: Record<string, any[]> = {}
  let totalRecords = 0
  let tablesExported = 0

  for (const table of tables) {
    const { data, error } = await (db.from(table) as any)
      .select("*")
      .eq("company_id", company_id)

    if (!error && data) {
      backupData[table] = data
      totalRecords += data.length
      tablesExported++
    }
  }

  // Specialne tabulky (companies nema company_id filter)
  const { data: companyData } = await (db.from("companies") as any)
    .select("*")
    .eq("id", company_id)
    .single() as { data: any; error: any }

  if (companyData) {
    backupData["companies"] = [companyData]
  }

  const backup = {
    meta: {
      exported_at: new Date().toISOString(),
      company_id,
      company_name: companyData?.name || "",
      exported_by: user.id,
      tables_count: tablesExported,
      total_records: totalRecords,
      version: "1.0",
    },
    data: backupData,
  }

  const jsonString = JSON.stringify(backup, null, 2)
  const sizeEstimate = `${(jsonString.length / 1024).toFixed(1)} KB`

  // Zaznamenat export do audit logu
  await logAction(db, {
    company_id,
    user_id: user.id,
    user_email: user.email || "",
    action: "export",
    entity_type: "settings",
    entity_id: company_id,
    old_values: null,
    new_values: {
      backup_type: "full",
      tables_exported: tablesExported,
      records_exported: totalRecords,
      size_estimate: sizeEstimate,
    },
    ip_address: null,
    user_agent: null,
  })

  return new NextResponse(jsonString, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="backup-${company_id}-${new Date().toISOString().split("T")[0]}.json"`,
    },
  })
}

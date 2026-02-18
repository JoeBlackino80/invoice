import type { SupabaseClient } from "@supabase/supabase-js"

// ============================================================================
// Audit Log Types
// ============================================================================

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "export"
  | "approve"
  | "post"
  | "reverse"

export type AuditEntityType =
  | "invoices"
  | "journal_entries"
  | "contacts"
  | "employees"
  | "bank_transactions"
  | "bank_accounts"
  | "cash_transactions"
  | "cash_registers"
  | "documents"
  | "chart_of_accounts"
  | "payroll_runs"
  | "payment_orders"
  | "quotes"
  | "orders"
  | "recurring_invoices"
  | "companies"
  | "users"
  | "settings"
  | "fiscal_years"
  | "assets"
  | "archive"
  | "gdpr"

export interface AuditLogEntry {
  id: string
  company_id: string
  user_id: string
  user_email: string
  action: AuditAction
  entity_type: AuditEntityType
  entity_id: string
  old_values: Record<string, any> | null
  new_values: Record<string, any> | null
  ip_address: string | null
  user_agent: string | null
  timestamp: string
}

export interface AuditLogFilters {
  entity_type?: AuditEntityType
  action?: AuditAction
  user_id?: string
  date_from?: string
  date_to?: string
  page?: number
  limit?: number
}

export interface SuspiciousActivity {
  type: "mass_deletion" | "unusual_login" | "locked_period_change"
  description: string
  severity: "low" | "medium" | "high"
  detected_at: string
  details: Record<string, any>
}

// ============================================================================
// logAction - Zapise audit log zaznam
// ============================================================================

export async function logAction(
  supabase: SupabaseClient,
  entry: Omit<AuditLogEntry, "id" | "timestamp">
): Promise<void> {
  const { error } = await (supabase.from("audit_log") as any).insert({
    company_id: entry.company_id,
    table_name: entry.entity_type,
    record_id: entry.entity_id,
    action: mapActionToDbAction(entry.action),
    old_values: entry.old_values,
    new_values: entry.new_values
      ? { ...entry.new_values, _user_email: entry.user_email, _audit_action: entry.action }
      : { _user_email: entry.user_email, _audit_action: entry.action },
    user_id: entry.user_id,
    ip_address: entry.ip_address,
    user_agent: entry.user_agent,
  })

  if (error) {
    console.error("Chyba pri zapisovani audit logu:", error.message)
  }
}

function mapActionToDbAction(action: AuditAction): "INSERT" | "UPDATE" | "DELETE" {
  switch (action) {
    case "create":
      return "INSERT"
    case "update":
    case "approve":
    case "post":
    case "reverse":
    case "login":
    case "logout":
    case "export":
      return "UPDATE"
    case "delete":
      return "DELETE"
    default:
      return "UPDATE"
  }
}

function mapDbActionToAction(dbAction: string, newValues: any): AuditAction {
  const auditAction = newValues?._audit_action
  if (auditAction) return auditAction as AuditAction

  switch (dbAction) {
    case "INSERT":
      return "create"
    case "DELETE":
      return "delete"
    case "UPDATE":
    default:
      return "update"
  }
}

// ============================================================================
// getAuditLog - Nacita audit log s filtrami
// ============================================================================

export async function getAuditLog(
  supabase: SupabaseClient,
  companyId: string,
  filters: AuditLogFilters = {}
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  let query = (supabase.from("audit_log") as any)
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (filters.entity_type) {
    query = query.eq("table_name", filters.entity_type)
  }

  if (filters.action) {
    const dbAction = mapActionToDbAction(filters.action)
    query = query.eq("action", dbAction)
  }

  if (filters.user_id) {
    query = query.eq("user_id", filters.user_id)
  }

  if (filters.date_from) {
    query = query.gte("created_at", filters.date_from)
  }

  if (filters.date_to) {
    query = query.lte("created_at", filters.date_to + "T23:59:59")
  }

  const { data, error, count } = await query

  if (error) {
    console.error("Chyba pri nacitani audit logu:", error.message)
    return { entries: [], total: 0 }
  }

  const entries: AuditLogEntry[] = (data || []).map((row: any) => ({
    id: row.id,
    company_id: row.company_id,
    user_id: row.user_id || "",
    user_email: row.new_values?._user_email || row.old_values?._user_email || "",
    action: mapDbActionToAction(row.action, row.new_values),
    entity_type: row.table_name as AuditEntityType,
    entity_id: row.record_id,
    old_values: row.old_values,
    new_values: row.new_values,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    timestamp: row.created_at,
  }))

  return { entries, total: count || 0 }
}

// ============================================================================
// detectSuspiciousActivity - Detekuje podozrivu aktivitu
// ============================================================================

export async function detectSuspiciousActivity(
  supabase: SupabaseClient,
  companyId: string
): Promise<SuspiciousActivity[]> {
  const suspicious: SuspiciousActivity[] = []
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // 1. Detekcia masoveho mazania (>10 za hodinu)
  const { data: deletions } = await (supabase.from("audit_log") as any)
    .select("user_id, table_name, created_at")
    .eq("company_id", companyId)
    .eq("action", "DELETE")
    .gte("created_at", oneHourAgo)

  if (deletions && deletions.length > 10) {
    const userCounts = new Map<string, number>()
    for (const d of deletions) {
      const key = d.user_id || "unknown"
      userCounts.set(key, (userCounts.get(key) || 0) + 1)
    }
    for (const [userId, count] of Array.from(userCounts.entries())) {
      if (count > 10) {
        suspicious.push({
          type: "mass_deletion",
          description: `Pouzivatel vykonal ${count} mazani za poslednu hodinu`,
          severity: count > 50 ? "high" : "medium",
          detected_at: new Date().toISOString(),
          details: { user_id: userId, deletion_count: count },
        })
      }
    }
  }

  // 2. Nezvycajne prihlasenia (viacero z roznych IP za kratky cas)
  const { data: logins } = await (supabase.from("audit_log") as any)
    .select("user_id, ip_address, created_at, new_values")
    .eq("company_id", companyId)
    .gte("created_at", oneDayAgo)

  if (logins) {
    const loginEntries = logins.filter(
      (l: any) => l.new_values?._audit_action === "login"
    )
    const userIps = new Map<string, Set<string>>()
    for (const login of loginEntries) {
      const uid = login.user_id || "unknown"
      if (!userIps.has(uid)) {
        userIps.set(uid, new Set<string>())
      }
      if (login.ip_address) {
        userIps.get(uid)!.add(login.ip_address)
      }
    }
    for (const [userId, ips] of Array.from(userIps.entries())) {
      if (ips.size > 5) {
        suspicious.push({
          type: "unusual_login",
          description: `Pouzivatel sa prihlasil z ${ips.size} roznych IP adries za 24 hodin`,
          severity: "medium",
          detected_at: new Date().toISOString(),
          details: {
            user_id: userId,
            ip_count: ips.size,
            ips: Array.from(ips),
          },
        })
      }
    }
  }

  // 3. Zmeny v uzavretych obdobiach
  const { data: lockedChanges } = await (supabase.from("audit_log") as any)
    .select("*")
    .eq("company_id", companyId)
    .eq("table_name", "fiscal_years")
    .gte("created_at", oneDayAgo)

  if (lockedChanges && lockedChanges.length > 0) {
    for (const change of lockedChanges) {
      const oldStatus = change.old_values?.status
      const newStatus = change.new_values?.status
      if (oldStatus === "uzavrety" && newStatus !== "uzavrety") {
        suspicious.push({
          type: "locked_period_change",
          description: "Bolo zmenene uzavrete obdobie",
          severity: "high",
          detected_at: new Date().toISOString(),
          details: {
            record_id: change.record_id,
            old_status: oldStatus,
            new_status: newStatus,
            user_id: change.user_id,
          },
        })
      }
    }
  }

  return suspicious
}

// ============================================================================
// generateAuditReport - Generuje CSV report z audit logov
// ============================================================================

export function generateAuditReport(entries: AuditLogEntry[]): string {
  const headers = [
    "Cas",
    "Pouzivatel",
    "Email",
    "Akcia",
    "Typ entity",
    "ID entity",
    "IP adresa",
    "Stare hodnoty",
    "Nove hodnoty",
  ]

  const rows = entries.map((entry) => [
    entry.timestamp,
    entry.user_id,
    entry.user_email,
    entry.action,
    entry.entity_type,
    entry.entity_id,
    entry.ip_address || "",
    entry.old_values ? JSON.stringify(entry.old_values) : "",
    entry.new_values ? JSON.stringify(entry.new_values) : "",
  ])

  const csvContent = [
    headers.join(";"),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
    ),
  ].join("\n")

  // BOM pre spravne zobrazenie diakritiky v Exceli
  return "\uFEFF" + csvContent
}

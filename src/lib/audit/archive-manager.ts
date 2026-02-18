import type { SupabaseClient } from "@supabase/supabase-js"

// ============================================================================
// Retencne lehoty podla slovenskej legislativy
// ============================================================================

export const RETENTION_PERIODS: Record<string, { years: number; law: string; label: string }> = {
  accounting_documents: {
    years: 10,
    law: "\u00a735 z\u00e1kon o \u00fa\u010dtovn\u00edctve",
    label: "\u00da\u010dtovn\u00e9 doklady",
  },
  financial_statements: {
    years: 10,
    law: "\u00a735 z\u00e1kon o \u00fa\u010dtovn\u00edctve",
    label: "\u00da\u010dtovn\u00e9 z\u00e1vierky",
  },
  tax_documents: {
    years: 10,
    law: "\u00a776 z\u00e1kon o DPH",
    label: "Da\u0148ov\u00e9 doklady",
  },
  payroll_records: {
    years: 50,
    law: "z\u00e1kon o arch\u00edvoch",
    label: "Mzdov\u00e9 z\u00e1znamy",
  },
  employment_contracts: {
    years: 50,
    law: "z\u00e1kon o arch\u00edvoch",
    label: "Pracovn\u00e9 zmluvy",
  },
  invoices: {
    years: 10,
    law: "\u00a776 z\u00e1kon o DPH",
    label: "Fakt\u00fary",
  },
  bank_statements: {
    years: 10,
    law: "\u00a735 z\u00e1kon o \u00fa\u010dtovn\u00edctve",
    label: "Bankov\u00e9 v\u00fdpisy",
  },
}

// ============================================================================
// Types
// ============================================================================

export type ArchiveStatus = "active" | "archived" | "expired"

export interface ArchiveRecord {
  entity_type: string
  entity_id: string
  archived_at: string
  retention_until: string
  status: ArchiveStatus
}

export interface ArchiveResult {
  success: boolean
  archived_count: number
  entity_types: Record<string, number>
  period_end: string
  error?: string
}

export interface ExpiringArchive {
  entity_type: string
  entity_id: string
  retention_until: string
  days_remaining: number
  label: string
}

export interface ArchiveStatusSummary {
  entity_type: string
  label: string
  total_count: number
  archived_count: number
  active_count: number
  oldest_record: string | null
  newest_record: string | null
  retention_years: number
  law: string
  status: "ok" | "warning" | "expired"
}

// ============================================================================
// archiveClosedPeriod - Archivuje uzavrete obdobie
// ============================================================================

export async function archiveClosedPeriod(
  supabase: SupabaseClient,
  companyId: string,
  periodEnd: string
): Promise<ArchiveResult> {
  const entityTypes: Record<string, number> = {}
  let totalArchived = 0

  const tablesToArchive = [
    { table: "invoices", dateField: "issue_date", type: "invoices" },
    { table: "journal_entries", dateField: "entry_date", type: "accounting_documents" },
    { table: "bank_transactions", dateField: "transaction_date", type: "bank_statements" },
    { table: "cash_transactions", dateField: "transaction_date", type: "accounting_documents" },
    { table: "documents", dateField: "created_at", type: "accounting_documents" },
  ]

  for (const { table, dateField, type } of tablesToArchive) {
    const { data, error } = await (supabase.from(table) as any)
      .select("id")
      .eq("company_id", companyId)
      .lte(dateField, periodEnd)
      .is("deleted_at", null)

    if (error) {
      continue
    }

    if (data && data.length > 0) {
      const retentionYears = RETENTION_PERIODS[type]?.years || 10
      const retentionUntil = new Date(periodEnd)
      retentionUntil.setFullYear(retentionUntil.getFullYear() + retentionYears)

      // Vlozenie archivnych zaznamov
      const archiveRecords = data.map((record: any) => ({
        company_id: companyId,
        entity_type: type,
        entity_id: record.id,
        source_table: table,
        archived_at: new Date().toISOString(),
        retention_until: retentionUntil.toISOString(),
        period_end: periodEnd,
        status: "archived",
      }))

      const { error: insertError } = await (supabase.from("archive_records") as any)
        .upsert(archiveRecords, { onConflict: "entity_id,source_table" })

      if (!insertError) {
        entityTypes[type] = (entityTypes[type] || 0) + data.length
        totalArchived += data.length
      }
    }
  }

  return {
    success: true,
    archived_count: totalArchived,
    entity_types: entityTypes,
    period_end: periodEnd,
  }
}

// ============================================================================
// checkExpiringArchives - Najde zaznamy blizko konca retencnej lehoty
// ============================================================================

export async function checkExpiringArchives(
  supabase: SupabaseClient,
  companyId: string
): Promise<ExpiringArchive[]> {
  const threeMonthsFromNow = new Date()
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

  const { data, error } = await (supabase.from("archive_records") as any)
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "archived")
    .lte("retention_until", threeMonthsFromNow.toISOString())
    .order("retention_until", { ascending: true })
    .limit(100)

  if (error || !data) {
    return []
  }

  const now = new Date()
  return data.map((record: any) => {
    const retentionDate = new Date(record.retention_until)
    const daysRemaining = Math.ceil(
      (retentionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    const retPeriod = RETENTION_PERIODS[record.entity_type]
    return {
      entity_type: record.entity_type,
      entity_id: record.entity_id,
      retention_until: record.retention_until,
      days_remaining: daysRemaining,
      label: retPeriod?.label || record.entity_type,
    }
  })
}

// ============================================================================
// getArchiveStatus - Sumar archivovanych zaznamov podla typu
// ============================================================================

export async function getArchiveStatus(
  supabase: SupabaseClient,
  companyId: string
): Promise<ArchiveStatusSummary[]> {
  const summaries: ArchiveStatusSummary[] = []
  const now = new Date()
  const warningThreshold = new Date()
  warningThreshold.setMonth(warningThreshold.getMonth() + 6)

  for (const [entityType, config] of Object.entries(RETENTION_PERIODS)) {
    // Pocet archivovanych zaznamov
    const { data: archived, count: archivedCount } = await (supabase
      .from("archive_records") as any)
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .eq("entity_type", entityType)
      .eq("status", "archived")
      .order("archived_at", { ascending: true })
      .limit(1)

    const { data: archivedNewest } = await (supabase
      .from("archive_records") as any)
      .select("archived_at")
      .eq("company_id", companyId)
      .eq("entity_type", entityType)
      .eq("status", "archived")
      .order("archived_at", { ascending: false })
      .limit(1)

    // Kontrola expiracie
    const { count: expiredCount } = await (supabase
      .from("archive_records") as any)
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .eq("entity_type", entityType)
      .lt("retention_until", now.toISOString())

    const { count: warningCount } = await (supabase
      .from("archive_records") as any)
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .eq("entity_type", entityType)
      .lt("retention_until", warningThreshold.toISOString())
      .gte("retention_until", now.toISOString())

    let status: "ok" | "warning" | "expired" = "ok"
    if ((expiredCount || 0) > 0) status = "expired"
    else if ((warningCount || 0) > 0) status = "warning"

    const totalCount = archivedCount || 0
    const oldestRecord = archived && archived.length > 0 ? archived[0].archived_at : null
    const newestRecord = archivedNewest && archivedNewest.length > 0 ? archivedNewest[0].archived_at : null

    summaries.push({
      entity_type: entityType,
      label: config.label,
      total_count: totalCount,
      archived_count: totalCount,
      active_count: 0,
      oldest_record: oldestRecord,
      newest_record: newestRecord,
      retention_years: config.years,
      law: config.law,
      status,
    })
  }

  return summaries
}

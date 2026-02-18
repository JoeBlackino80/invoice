import type { SupabaseClient } from "@supabase/supabase-js"
import { RETENTION_PERIODS } from "./archive-manager"

// ============================================================================
// Types
// ============================================================================

export interface PersonalDataExport {
  person_type: "employee" | "contact"
  person_id: string
  exported_at: string
  data: {
    basic_info: Record<string, any>
    addresses: Record<string, any>[]
    financial_data: Record<string, any>[]
    documents: Record<string, any>[]
    activity_log: Record<string, any>[]
  }
}

export interface AnonymizeResult {
  success: boolean
  person_type: "employee" | "contact"
  person_id: string
  anonymized_fields: string[]
  preserved_records: string[]
  error?: string
}

export interface DataProcessingRecord {
  id: string
  category: string
  purpose: string
  legal_basis: string
  retention_period: string
  recipients: string
  description: string
}

export interface RetentionCheck {
  entity_type: string
  label: string
  records_beyond_retention: number
  oldest_record_date: string | null
  retention_years: number
  status: "ok" | "warning" | "violation"
}

// ============================================================================
// Standardne zaznamy o spracovani (GDPR clanok 30)
// ============================================================================

export const STANDARD_PROCESSING_RECORDS: DataProcessingRecord[] = [
  {
    id: "proc-1",
    category: "Zamestnanecke udaje",
    purpose: "Vedenie mzdovej agendy, plnenie pracovnej zmluvy",
    legal_basis: "Plnenie zmluvy (cl. 6 ods. 1 pism. b) GDPR), Zakonny zaklad (cl. 6 ods. 1 pism. c) GDPR)",
    retention_period: "50 rokov (zakon o archivoch)",
    recipients: "Socialna poistovna, zdravotne poistovne, danovy urad",
    description: "Spracovanie osobnych udajov zamestnancov pre ucely mzdovej agendy",
  },
  {
    id: "proc-2",
    category: "Kontaktne udaje odberatelov/dodavatelov",
    purpose: "Fakturacia, vedenie uctovnictva",
    legal_basis: "Plnenie zmluvy (cl. 6 ods. 1 pism. b) GDPR), Zakonny zaklad (cl. 6 ods. 1 pism. c) GDPR)",
    retention_period: "10 rokov (zakon o uctovnictve, zakon o DPH)",
    recipients: "Danovy urad, auditor",
    description: "Spracovanie kontaktnych a fakturacnych udajov obchodnych partnerov",
  },
  {
    id: "proc-3",
    category: "Bankove a platobne udaje",
    purpose: "Spracovanie platieb, bankove prevody",
    legal_basis: "Plnenie zmluvy (cl. 6 ods. 1 pism. b) GDPR)",
    retention_period: "10 rokov (zakon o uctovnictve)",
    recipients: "Banka, danovy urad",
    description: "Bankove ucty, IBAN, platobne prikazy",
  },
  {
    id: "proc-4",
    category: "Prihlasovanie a bezpecnost",
    purpose: "Bezpecnost systemu, audit trail",
    legal_basis: "Opravneny zaujem (cl. 6 ods. 1 pism. f) GDPR)",
    retention_period: "3 roky",
    recipients: "Interne - spravca systemu",
    description: "Logy prihlaseni, IP adresy, audit zaznamy",
  },
  {
    id: "proc-5",
    category: "Danove udaje",
    purpose: "Plnenie danovych povinnosti, podavanie danovych priznani",
    legal_basis: "Zakonny zaklad (cl. 6 ods. 1 pism. c) GDPR)",
    retention_period: "10 rokov (zakon o DPH, danovy poriadok)",
    recipients: "Danovy urad, financna sprava",
    description: "DIC, IC DPH, danove doklady, KV DPH",
  },
]

// ============================================================================
// exportPersonalData - Export vsetkych osobnych udajov (pravo na pristup)
// ============================================================================

export async function exportPersonalData(
  supabase: SupabaseClient,
  companyId: string,
  personType: "employee" | "contact",
  personId: string
): Promise<PersonalDataExport> {
  const exportData: PersonalDataExport = {
    person_type: personType,
    person_id: personId,
    exported_at: new Date().toISOString(),
    data: {
      basic_info: {},
      addresses: [],
      financial_data: [],
      documents: [],
      activity_log: [],
    },
  }

  if (personType === "contact") {
    // Zakladne udaje kontaktu
    const { data: contact } = await (supabase.from("contacts") as any)
      .select("*")
      .eq("id", personId)
      .eq("company_id", companyId)
      .single() as { data: any; error: any }

    if (contact) {
      exportData.data.basic_info = {
        name: contact.name,
        ico: contact.ico,
        dic: contact.dic,
        ic_dph: contact.ic_dph,
        email: contact.email,
        phone: contact.phone,
        web: contact.web,
        type: contact.type,
        notes: contact.notes,
        created_at: contact.created_at,
      }

      exportData.data.addresses = [
        {
          type: "fakturacna",
          street: contact.street,
          city: contact.city,
          zip: contact.zip,
          country: contact.country,
        },
      ]
    }

    // Faktury spojene s kontaktom
    const { data: invoices } = await (supabase.from("invoices") as any)
      .select("id, number, type, total_amount, currency, issue_date, status")
      .eq("contact_id", personId)
      .eq("company_id", companyId)
      .is("deleted_at", null)

    if (invoices) {
      exportData.data.financial_data = invoices.map((inv: any) => ({
        type: "faktura",
        number: inv.number,
        invoice_type: inv.type,
        amount: inv.total_amount,
        currency: inv.currency,
        date: inv.issue_date,
        status: inv.status,
      }))
    }

    // Dokumenty
    const { data: documents } = await (supabase.from("documents") as any)
      .select("id, name, type, created_at")
      .eq("company_id", companyId)
      .eq("contact_id", personId)

    if (documents) {
      exportData.data.documents = documents.map((doc: any) => ({
        name: doc.name,
        type: doc.type,
        created_at: doc.created_at,
      }))
    }

    // Audit logy tykajuce sa kontaktu
    const { data: logs } = await (supabase.from("audit_log") as any)
      .select("action, created_at, old_values, new_values")
      .eq("company_id", companyId)
      .eq("table_name", "contacts")
      .eq("record_id", personId)
      .order("created_at", { ascending: false })
      .limit(50)

    if (logs) {
      exportData.data.activity_log = logs.map((log: any) => ({
        action: log.action,
        timestamp: log.created_at,
      }))
    }
  } else if (personType === "employee") {
    // Zakladne udaje zamestnanca
    const { data: employee } = await (supabase.from("employees") as any)
      .select("*")
      .eq("id", personId)
      .eq("company_id", companyId)
      .single() as { data: any; error: any }

    if (employee) {
      exportData.data.basic_info = {
        first_name: employee.first_name,
        last_name: employee.last_name,
        title_before: employee.title_before,
        title_after: employee.title_after,
        birth_date: employee.birth_date,
        birth_number: employee.birth_number,
        email: employee.email,
        phone: employee.phone,
        id_card_number: employee.id_card_number,
        tax_id: employee.tax_id,
        health_insurance: employee.health_insurance_company,
        social_insurance_number: employee.social_insurance_number,
        created_at: employee.created_at,
      }

      exportData.data.addresses = [
        {
          type: "trvaly_pobyt",
          street: employee.street,
          city: employee.city,
          zip: employee.zip,
          country: employee.country,
        },
      ]

      exportData.data.financial_data = [
        {
          type: "bankove_udaje",
          iban: employee.iban,
          bank_name: employee.bank_name,
        },
        {
          type: "mzdove_udaje",
          gross_salary: employee.gross_salary,
          employment_type: employee.employment_type,
          start_date: employee.start_date,
          end_date: employee.end_date,
        },
      ]
    }

    // Vyplatne pasky
    const { data: payslips } = await (supabase.from("payslips") as any)
      .select("id, period, gross_salary, net_salary, created_at")
      .eq("employee_id", personId)
      .eq("company_id", companyId)
      .order("period", { ascending: false })

    if (payslips) {
      for (const slip of payslips) {
        exportData.data.financial_data.push({
          type: "vyplatna_paska",
          period: slip.period,
          gross: slip.gross_salary,
          net: slip.net_salary,
        })
      }
    }

    // Audit log
    const { data: logs } = await (supabase.from("audit_log") as any)
      .select("action, created_at")
      .eq("company_id", companyId)
      .eq("table_name", "employees")
      .eq("record_id", personId)
      .order("created_at", { ascending: false })
      .limit(50)

    if (logs) {
      exportData.data.activity_log = logs.map((log: any) => ({
        action: log.action,
        timestamp: log.created_at,
      }))
    }
  }

  return exportData
}

// ============================================================================
// anonymizePersonalData - Anonymizacia osobnych udajov
// ============================================================================

export async function anonymizePersonalData(
  supabase: SupabaseClient,
  companyId: string,
  personType: "employee" | "contact",
  personId: string
): Promise<AnonymizeResult> {
  const anonymizedFields: string[] = []
  const preservedRecords: string[] = []
  const ANON = "ANONYMIZOVANE"

  if (personType === "contact") {
    // Kontrola retencnej lehoty - faktury sa musia uchovat 10 rokov
    const { data: oldestInvoice } = await (supabase.from("invoices") as any)
      .select("issue_date")
      .eq("contact_id", personId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("issue_date", { ascending: true })
      .limit(1)

    if (oldestInvoice && oldestInvoice.length > 0) {
      const invoiceDate = new Date(oldestInvoice[0].issue_date)
      const retentionEnd = new Date(invoiceDate)
      retentionEnd.setFullYear(retentionEnd.getFullYear() + 10)

      if (retentionEnd > new Date()) {
        return {
          success: false,
          person_type: personType,
          person_id: personId,
          anonymized_fields: [],
          preserved_records: [],
          error: `Nie je mozne anonymizovat - retencna lehota pre uctovne doklady uplynie ${retentionEnd.toISOString().split("T")[0]}`,
        }
      }
    }

    // Anonymizacia kontaktu
    const { error } = await (supabase.from("contacts") as any)
      .update({
        name: ANON,
        email: null,
        phone: null,
        web: null,
        street: null,
        city: null,
        zip: null,
        notes: null,
        contact_person: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", personId)
      .eq("company_id", companyId)

    if (error) {
      return {
        success: false,
        person_type: personType,
        person_id: personId,
        anonymized_fields: [],
        preserved_records: [],
        error: error.message,
      }
    }

    anonymizedFields.push("name", "email", "phone", "web", "street", "city", "zip", "notes", "contact_person")

    // ICO, DIC, IC DPH sa zachovavaju pre uctovne ucely
    preservedRecords.push("ICO (uctovne ucely)", "DIC (uctovne ucely)", "IC DPH (uctovne ucely)", "Faktury (retencna lehota)")

  } else if (personType === "employee") {
    // Kontrola retencnej lehoty - mzdove zaznamy 50 rokov
    const { data: employee } = await (supabase.from("employees") as any)
      .select("start_date, end_date")
      .eq("id", personId)
      .eq("company_id", companyId)
      .single() as { data: any; error: any }

    if (employee) {
      const endDate = employee.end_date ? new Date(employee.end_date) : new Date()
      const retentionEnd = new Date(endDate)
      retentionEnd.setFullYear(retentionEnd.getFullYear() + 50)

      if (retentionEnd > new Date()) {
        return {
          success: false,
          person_type: personType,
          person_id: personId,
          anonymized_fields: [],
          preserved_records: [],
          error: `Nie je mozne anonymizovat - retencna lehota pre mzdove zaznamy uplynie ${retentionEnd.toISOString().split("T")[0]}`,
        }
      }
    }

    // Anonymizacia zamestnanca
    const { error } = await (supabase.from("employees") as any)
      .update({
        first_name: ANON,
        last_name: ANON,
        email: null,
        phone: null,
        street: null,
        city: null,
        zip: null,
        birth_number: null,
        id_card_number: null,
        iban: null,
        bank_name: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", personId)
      .eq("company_id", companyId)

    if (error) {
      return {
        success: false,
        person_type: personType,
        person_id: personId,
        anonymized_fields: [],
        preserved_records: [],
        error: error.message,
      }
    }

    anonymizedFields.push(
      "first_name", "last_name", "email", "phone",
      "street", "city", "zip", "birth_number",
      "id_card_number", "iban", "bank_name"
    )
    preservedRecords.push(
      "Tax ID (danove ucely)",
      "Mzdove zaznamy (retencna lehota 50 rokov)",
      "Vyplatne pasky (retencna lehota)"
    )
  }

  return {
    success: true,
    person_type: personType,
    person_id: personId,
    anonymized_fields: anonymizedFields,
    preserved_records: preservedRecords,
  }
}

// ============================================================================
// getProcessingRecords - GDPR clanok 30 zaznamy o spracovani
// ============================================================================

export async function getProcessingRecords(
  _supabase: SupabaseClient,
  _companyId: string
): Promise<DataProcessingRecord[]> {
  // Standardne zaznamy o spracovani pre uctovny system
  // V produkcii by sa nacitavali z databazy
  return STANDARD_PROCESSING_RECORDS
}

// ============================================================================
// checkRetentionCompliance - Kontrola retencnych lehot
// ============================================================================

export async function checkRetentionCompliance(
  supabase: SupabaseClient,
  companyId: string
): Promise<RetentionCheck[]> {
  const checks: RetentionCheck[] = []
  const now = new Date()

  const tableChecks = [
    { table: "invoices", dateField: "issue_date", type: "invoices", label: "Faktury" },
    { table: "journal_entries", dateField: "entry_date", type: "accounting_documents", label: "Uctovne zaznamy" },
    { table: "bank_transactions", dateField: "transaction_date", type: "bank_statements", label: "Bankove transakcie" },
  ]

  for (const check of tableChecks) {
    const retentionYears = RETENTION_PERIODS[check.type]?.years || 10
    const cutoffDate = new Date(now)
    cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears)

    // Zaznamy starsie ako retencna lehota
    const { count: beyondRetention } = await (supabase.from(check.table) as any)
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .lt(check.dateField, cutoffDate.toISOString().split("T")[0])
      .is("deleted_at", null)

    // Najstarsi zaznam
    const { data: oldest } = await (supabase.from(check.table) as any)
      .select(check.dateField)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order(check.dateField, { ascending: true })
      .limit(1)

    const oldestDate = oldest && oldest.length > 0 ? oldest[0][check.dateField] : null

    let status: "ok" | "warning" | "violation" = "ok"
    const count = beyondRetention || 0
    if (count > 0) {
      status = "violation"
    } else if (oldestDate) {
      const oldDate = new Date(oldestDate)
      const warnDate = new Date(cutoffDate)
      warnDate.setFullYear(warnDate.getFullYear() + 1) // varovanie rok pred
      if (oldDate < warnDate) {
        status = "warning"
      }
    }

    checks.push({
      entity_type: check.type,
      label: check.label,
      records_beyond_retention: count,
      oldest_record_date: oldestDate,
      retention_years: retentionYears,
      status,
    })
  }

  return checks
}

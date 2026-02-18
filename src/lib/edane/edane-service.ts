/**
 * eDane Filing Service for Slovak Financial Administration
 *
 * Prepared architecture for electronic tax filing (podania)
 * to Financna sprava SR. Currently operates in simulated mode
 * - all submissions are stored locally and processed with
 * simulated responses.
 */

import { validateAgainstSchema, type ValidationResult } from "./xml-validator"

// ===================== Types =====================

export type SubmissionStatus =
  | "draft"
  | "validated"
  | "submitted"
  | "accepted"
  | "rejected"

export type SubmissionType =
  | "dph_priznanie"
  | "kontrolny_vykaz"
  | "suhrnny_vykaz"
  | "dppo"
  | "dpfo"
  | "mesacny_prehlad"
  | "rocne_hlasenie"

export interface SubmissionRecord {
  id: string
  company_id: string
  type: SubmissionType
  period: string
  xml_content: string
  status: SubmissionStatus
  submitted_at: string | null
  response_message: string | null
  reference_number: string | null
  created_at: string
  updated_at: string
}

export interface SubmissionResult {
  success: boolean
  reference_number: string | null
  message: string
  submitted_at: string | null
}

/**
 * Maps submission types to human-readable Slovak labels.
 */
export const SUBMISSION_TYPE_LABELS: Record<SubmissionType, string> = {
  dph_priznanie: "Priznanie k DPH",
  kontrolny_vykaz: "Kontrolny vykaz DPH",
  suhrnny_vykaz: "Suhrnny vykaz",
  dppo: "Dan z prijmov pravnickych osob",
  dpfo: "Dan z prijmov fyzickych osob",
  mesacny_prehlad: "Mesacny prehlad o zrazkach dane",
  rocne_hlasenie: "Rocne hlasenie o zrazkach dane",
}

/**
 * Maps submission types to their corresponding XML schema types
 * for validation purposes.
 */
const SUBMISSION_SCHEMA_MAP: Record<SubmissionType, string> = {
  dph_priznanie: "dph",
  kontrolny_vykaz: "kvdph",
  suhrnny_vykaz: "sv",
  dppo: "dppo",
  dpfo: "dpfo",
  mesacny_prehlad: "mvp_sp",
  rocne_hlasenie: "mvp_sp",
}

/**
 * Determines whether the submission type uses monthly or yearly period.
 */
export const SUBMISSION_PERIOD_TYPE: Record<SubmissionType, "monthly" | "yearly"> = {
  dph_priznanie: "monthly",
  kontrolny_vykaz: "monthly",
  suhrnny_vykaz: "monthly",
  dppo: "yearly",
  dpfo: "yearly",
  mesacny_prehlad: "monthly",
  rocne_hlasenie: "yearly",
}

// ===================== Helpers =====================

/**
 * Generate a unique ID for a submission record.
 */
function generateId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Generate a simulated reference number from FS SR.
 */
function generateReferenceNumber(): string {
  const year = new Date().getFullYear()
  const seq = Math.floor(Math.random() * 9000000) + 1000000
  return `FS-${year}-${seq}`
}

/**
 * Get current ISO timestamp.
 */
function now(): string {
  return new Date().toISOString()
}

// ===================== Service Functions =====================

/**
 * Create a new draft submission record.
 *
 * @param companyId - Company ID
 * @param type - Submission type (dph_priznanie, kontrolny_vykaz, etc.)
 * @param period - Period string (e.g., "2025-01" for monthly, "2025" for yearly)
 * @param xmlContent - XML content of the submission
 * @returns New SubmissionRecord in draft status
 */
export function prepareSubmission(
  companyId: string,
  type: SubmissionType,
  period: string,
  xmlContent: string
): SubmissionRecord {
  const timestamp = now()

  return {
    id: generateId(),
    company_id: companyId,
    type,
    period,
    xml_content: xmlContent,
    status: "draft",
    submitted_at: null,
    response_message: null,
    reference_number: null,
    created_at: timestamp,
    updated_at: timestamp,
  }
}

/**
 * Validate a submission's XML content against the appropriate schema.
 *
 * @param submission - The submission record to validate
 * @returns ValidationResult with errors and warnings
 */
export function validateSubmission(submission: SubmissionRecord): ValidationResult {
  const schemaType = SUBMISSION_SCHEMA_MAP[submission.type]

  if (!schemaType) {
    return {
      valid: false,
      errors: [
        {
          message: `Nepodporovany typ podania: "${submission.type}"`,
        },
      ],
      warnings: [],
    }
  }

  return validateAgainstSchema(submission.xml_content, schemaType)
}

/**
 * Submit to Financna sprava SR (simulated).
 *
 * In production, this would:
 * 1. Sign the XML with a qualified electronic signature
 * 2. Connect to FS SR web service
 * 3. Submit the signed XML
 * 4. Wait for and process the response
 *
 * Currently simulates the submission process:
 * - Validates the XML
 * - Generates a fake reference number
 * - Returns a simulated success response
 *
 * @param submission - The submission record to submit
 * @returns SubmissionResult with reference number and status
 */
export function submitToFS(submission: SubmissionRecord): SubmissionResult {
  // Pre-submission validation
  const validation = validateSubmission(submission)

  if (!validation.valid) {
    return {
      success: false,
      reference_number: null,
      message: `Podanie obsahuje chyby validacie: ${validation.errors.map((e) => e.message).join("; ")}`,
      submitted_at: null,
    }
  }

  // Simulate submission to FS SR
  // In production: SOAP/REST call to FS SR web services
  const referenceNumber = generateReferenceNumber()
  const submittedAt = now()

  return {
    success: true,
    reference_number: referenceNumber,
    message: `Podanie bolo uspesne prijate Financnou spravou SR. Referencne cislo: ${referenceNumber}`,
    submitted_at: submittedAt,
  }
}

/**
 * Get submission history for a company (simulated in-memory, for API usage with Supabase).
 *
 * This function provides the filtering logic. The actual data storage
 * and retrieval is handled by the API routes using Supabase.
 *
 * @param submissions - Array of all submissions
 * @param companyId - Company ID to filter by
 * @param type - Optional submission type filter
 * @param year - Optional year filter
 * @returns Filtered array of SubmissionRecord
 */
export function filterSubmissionHistory(
  submissions: SubmissionRecord[],
  companyId: string,
  type?: SubmissionType,
  year?: number
): SubmissionRecord[] {
  let filtered = submissions.filter((s) => s.company_id === companyId)

  if (type) {
    filtered = filtered.filter((s) => s.type === type)
  }

  if (year) {
    filtered = filtered.filter((s) => s.period.startsWith(String(year)))
  }

  // Sort by created_at descending
  filtered.sort((a, b) => b.created_at.localeCompare(a.created_at))

  return filtered
}

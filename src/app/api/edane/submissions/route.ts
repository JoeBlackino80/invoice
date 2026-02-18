import { NextResponse } from "next/server"
import { apiHandler } from "@/lib/api/handler"
import {
  prepareSubmission,
  validateSubmission,
  submitToFS,
  SUBMISSION_TYPE_LABELS,
  type SubmissionType,
} from "@/lib/edane/edane-service"

const VALID_TYPES: SubmissionType[] = [
  "dph_priznanie", "kontrolny_vykaz", "suhrnny_vykaz",
  "dppo", "dpfo", "mesacny_prehlad", "rocne_hlasenie",
]

// GET /api/edane/submissions - list submissions for a company
export const GET = apiHandler(async (request, { db, log }) => {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const type = searchParams.get("type")
  const year = searchParams.get("year")
  const status = searchParams.get("status")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  let query = (db.from("edane_submissions") as any)
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })

  if (type) query = query.eq("type", type)
  if (status) query = query.eq("status", status)
  if (year) query = query.like("period", `${year}%`)

  const { data, error, count } = await query

  if (error) {
    log.error("Failed to fetch submissions", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    count: count || 0,
    typeLabels: SUBMISSION_TYPE_LABELS,
  })
})

// POST /api/edane/submissions - create & optionally submit
export const POST = apiHandler(async (request, { user, db, log }) => {
  const body = await request.json()
  const { company_id, type, period, xml_content, action } = body

  if (!company_id || !type || !period || !xml_content) {
    return NextResponse.json({
      error: "company_id, type, period a xml_content sú povinné",
    }, { status: 400 })
  }

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({
      error: `Neplatný typ podania. Povolené: ${VALID_TYPES.join(", ")}`,
    }, { status: 400 })
  }

  // Prepare submission record
  const submission = prepareSubmission(company_id, type, period, xml_content)

  // Validate if requested
  if (action === "validate" || action === "submit") {
    const validation = validateSubmission(submission)

    if (!validation.valid) {
      // Store as draft with validation errors
      await (db.from("edane_submissions") as any).insert({
        company_id,
        type,
        period,
        xml_content,
        status: "draft",
        response_message: JSON.stringify(validation.errors),
        created_by: user.id,
      })

      return NextResponse.json({
        success: false,
        status: "draft",
        validation,
        message: "Podanie obsahuje chyby validácie",
      }, { status: 422 })
    }

    submission.status = "validated"
  }

  // Submit if requested
  if (action === "submit") {
    const result = submitToFS(submission)

    const dbRow = {
      company_id,
      type,
      period,
      xml_content,
      status: result.success ? "submitted" : "rejected",
      submitted_at: result.submitted_at,
      reference_number: result.reference_number,
      response_message: result.message,
      created_by: user.id,
    }

    const { data: saved, error: saveError } = await (db.from("edane_submissions") as any)
      .insert(dbRow)
      .select()
      .single()

    if (saveError) {
      log.error("Failed to save submission", saveError)
      return NextResponse.json({ error: saveError.message }, { status: 500 })
    }

    log.info(`eDane submission ${result.success ? "accepted" : "rejected"}`, {
      type,
      period,
      referenceNumber: result.reference_number,
    })

    return NextResponse.json({
      success: result.success,
      submission: saved,
      result,
    }, { status: result.success ? 201 : 422 })
  }

  // Just save as draft
  const { data: saved, error: saveError } = await (db.from("edane_submissions") as any)
    .insert({
      company_id,
      type,
      period,
      xml_content,
      status: submission.status,
      created_by: user.id,
    })
    .select()
    .single()

  if (saveError) {
    log.error("Failed to save draft submission", saveError)
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, submission: saved }, { status: 201 })
})

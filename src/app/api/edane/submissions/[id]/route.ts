import { NextResponse } from "next/server"
import { apiHandler } from "@/lib/api/handler"
import {
  validateSubmission,
  submitToFS,
  type SubmissionRecord,
} from "@/lib/edane/edane-service"

// GET /api/edane/submissions/:id - get submission detail
export const GET = apiHandler(async (request, { db, log, params }) => {
  const { data, error } = await (db.from("edane_submissions") as any)
    .select("*")
    .eq("id", params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Podanie nenájdené" }, { status: 404 })
  }

  return NextResponse.json(data)
})

// PUT /api/edane/submissions/:id - validate or submit a draft
export const PUT = apiHandler(async (request, { user, db, log, params }) => {
  const body = await request.json()
  const { action } = body

  // Fetch existing
  const { data: existing, error: fetchError } = await (db.from("edane_submissions") as any)
    .select("*")
    .eq("id", params.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Podanie nenájdené" }, { status: 404 })
  }

  if (existing.status === "submitted" || existing.status === "accepted") {
    return NextResponse.json({
      error: "Podanie už bolo odoslané, nemožno ho upraviť",
    }, { status: 400 })
  }

  const submission: SubmissionRecord = {
    id: existing.id,
    company_id: existing.company_id,
    type: existing.type,
    period: existing.period,
    xml_content: existing.xml_content,
    status: existing.status,
    submitted_at: existing.submitted_at,
    response_message: existing.response_message,
    reference_number: existing.reference_number,
    created_at: existing.created_at,
    updated_at: existing.updated_at,
  }

  if (action === "validate") {
    const validation = validateSubmission(submission)

    await (db.from("edane_submissions") as any)
      .update({
        status: validation.valid ? "validated" : "draft",
        response_message: validation.valid
          ? "Validácia úspešná"
          : JSON.stringify(validation.errors),
      })
      .eq("id", params.id)

    return NextResponse.json({
      success: validation.valid,
      validation,
    })
  }

  if (action === "submit") {
    // Validate first
    const validation = validateSubmission(submission)
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        validation,
        message: "Podanie obsahuje chyby validácie",
      }, { status: 422 })
    }

    // Submit
    const result = submitToFS(submission)

    await (db.from("edane_submissions") as any)
      .update({
        status: result.success ? "submitted" : "rejected",
        submitted_at: result.submitted_at,
        reference_number: result.reference_number,
        response_message: result.message,
      })
      .eq("id", params.id)

    log.info(`eDane submission ${result.success ? "submitted" : "rejected"}`, {
      submissionId: params.id,
      referenceNumber: result.reference_number,
    })

    return NextResponse.json({ success: result.success, result })
  }

  return NextResponse.json({
    error: "Neplatná akcia. Použite: validate, submit",
  }, { status: 400 })
})

// DELETE /api/edane/submissions/:id - delete a draft submission
export const DELETE = apiHandler(async (request, { db, log, params }) => {
  const { data: existing } = await (db.from("edane_submissions") as any)
    .select("status")
    .eq("id", params.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: "Podanie nenájdené" }, { status: 404 })
  }

  if (existing.status === "submitted" || existing.status === "accepted") {
    return NextResponse.json({
      error: "Nemožno vymazať odoslané podanie",
    }, { status: 400 })
  }

  const { error } = await (db.from("edane_submissions") as any)
    .delete()
    .eq("id", params.id)

  if (error) {
    log.error("Failed to delete submission", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
})

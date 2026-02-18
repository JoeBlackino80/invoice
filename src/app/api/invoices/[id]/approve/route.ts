import { NextResponse } from "next/server"
import { apiHandler } from "@/lib/api/handler"
import {
  initiateApproval,
  approveStep,
  rejectStep,
  getApprovalStatus,
  DEFAULT_APPROVAL_STEPS,
} from "@/lib/invoices/approval-workflow"

// GET /api/invoices/:id/approve - Get approval status
export const GET = apiHandler(async (request, { user, db, log, params }) => {
  const { data: invoice } = await (db.from("invoices") as any)
    .select("company_id")
    .eq("id", params.id)
    .single()

  if (!invoice) {
    return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 })
  }

  const { data: membership } = await (db.from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", invoice.company_id)
    .single()

  const userRole = membership?.role || "viewer"
  const status = await getApprovalStatus(db, params.id, userRole)

  return NextResponse.json(status || { approvalStatus: "none", steps: [] })
})

// POST /api/invoices/:id/approve - Initiate or approve/reject step
export const POST = apiHandler(async (request, { user, db, log, params }) => {
  const body = await request.json()
  const { action, notes } = body

  const { data: invoice } = await (db.from("invoices") as any)
    .select("company_id, approval_status, type")
    .eq("id", params.id)
    .single()

  if (!invoice) {
    return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 })
  }

  const { data: membership } = await (db.from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", invoice.company_id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: "Nemáte prístup k tejto firme" }, { status: 403 })
  }

  const userRole = membership.role

  if (action === "initiate") {
    if (invoice.approval_status !== "none" && invoice.approval_status !== "rejected") {
      return NextResponse.json({
        error: "Schvaľovací proces už prebieha alebo bol dokončený",
      }, { status: 400 })
    }

    await initiateApproval(db, invoice.company_id, params.id, DEFAULT_APPROVAL_STEPS)
    log.info("Approval workflow initiated", { invoiceId: params.id })
    return NextResponse.json({ success: true, message: "Schvaľovací proces bol spustený" })
  }

  if (action === "approve") {
    const result = await approveStep(db, params.id, user.id, userRole, notes)
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
    log.info("Approval step approved", { invoiceId: params.id, step: result.nextStep })
    return NextResponse.json(result)
  }

  if (action === "reject") {
    if (!notes) {
      return NextResponse.json({ error: "Dôvod zamietnutia je povinný" }, { status: 400 })
    }
    const result = await rejectStep(db, params.id, user.id, userRole, notes)
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
    log.info("Approval step rejected", { invoiceId: params.id })
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: "Neplatná akcia. Použite: initiate, approve, reject" }, { status: 400 })
})

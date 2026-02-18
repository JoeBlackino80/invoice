/**
 * Invoice Approval Workflow
 * Multi-level approval: fakturant → účtovník → konateľ
 * Configurable per company.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export interface ApprovalStep {
  step: number
  stepName: string
  requiredRole: string
  label: string
}

/** Default 3-level approval workflow */
export const DEFAULT_APPROVAL_STEPS: ApprovalStep[] = [
  { step: 1, stepName: "fakturant", requiredRole: "fakturant", label: "Fakturant" },
  { step: 2, stepName: "uctovnik", requiredRole: "uctovnik", label: "Účtovník" },
  { step: 3, stepName: "konatel", requiredRole: "admin", label: "Konateľ" },
]

/** Simplified 2-level workflow */
export const SIMPLE_APPROVAL_STEPS: ApprovalStep[] = [
  { step: 1, stepName: "uctovnik", requiredRole: "uctovnik", label: "Účtovník" },
  { step: 2, stepName: "konatel", requiredRole: "admin", label: "Konateľ" },
]

export interface ApprovalStatus {
  invoiceId: string
  approvalStatus: "none" | "pending" | "in_progress" | "approved" | "rejected"
  currentStep: number
  totalSteps: number
  steps: Array<{
    step: number
    stepName: string
    label: string
    status: "pending" | "approved" | "rejected" | "skipped"
    actionedBy?: string
    actionedAt?: string
    notes?: string
  }>
  canApprove: boolean
  canReject: boolean
}

/**
 * Initiate approval workflow for an invoice.
 * Creates approval records for each step.
 */
export async function initiateApproval(
  db: SupabaseClient,
  companyId: string,
  invoiceId: string,
  steps: ApprovalStep[] = DEFAULT_APPROVAL_STEPS
): Promise<void> {
  // Delete existing approvals for this invoice (in case of re-submit)
  await (db.from("invoice_approvals") as any)
    .delete()
    .eq("invoice_id", invoiceId)

  // Create approval records
  const rows = steps.map((s) => ({
    company_id: companyId,
    invoice_id: invoiceId,
    step: s.step,
    step_name: s.stepName,
    required_role: s.requiredRole,
    status: s.step === 1 ? "pending" : "pending",
  }))

  await (db.from("invoice_approvals") as any).insert(rows)

  // Update invoice
  await (db.from("invoices") as any)
    .update({
      approval_status: "pending",
      current_approval_step: 1,
    })
    .eq("id", invoiceId)
}

/**
 * Approve the current step of an invoice.
 */
export async function approveStep(
  db: SupabaseClient,
  invoiceId: string,
  userId: string,
  userRole: string,
  notes?: string
): Promise<{ success: boolean; message: string; nextStep?: number; isFullyApproved?: boolean }> {
  // Get current pending approval step
  const { data: currentApproval } = await (db.from("invoice_approvals") as any)
    .select("*")
    .eq("invoice_id", invoiceId)
    .eq("status", "pending")
    .order("step", { ascending: true })
    .limit(1)
    .single()

  if (!currentApproval) {
    return { success: false, message: "Žiadny krok na schválenie" }
  }

  // Check if user has the required role
  const canApprove = userRole === "admin" || userRole === currentApproval.required_role
  if (!canApprove) {
    return {
      success: false,
      message: `Na schválenie tohto kroku je potrebná rola: ${currentApproval.required_role}`,
    }
  }

  // Approve the step
  await (db.from("invoice_approvals") as any)
    .update({
      status: "approved",
      actioned_by: userId,
      actioned_at: new Date().toISOString(),
      notes: notes || null,
    })
    .eq("id", currentApproval.id)

  // Check if there's a next step
  const { data: nextSteps } = await (db.from("invoice_approvals") as any)
    .select("step")
    .eq("invoice_id", invoiceId)
    .eq("status", "pending")
    .gt("step", currentApproval.step)
    .order("step", { ascending: true })
    .limit(1)

  if (nextSteps && nextSteps.length > 0) {
    // Move to next step
    await (db.from("invoices") as any)
      .update({
        approval_status: "in_progress",
        current_approval_step: nextSteps[0].step,
      })
      .eq("id", invoiceId)

    return {
      success: true,
      message: `Krok ${currentApproval.step} schválený. Čaká sa na krok ${nextSteps[0].step}.`,
      nextStep: nextSteps[0].step,
    }
  }

  // Fully approved
  await (db.from("invoices") as any)
    .update({
      approval_status: "approved",
      current_approval_step: currentApproval.step,
    })
    .eq("id", invoiceId)

  return {
    success: true,
    message: "Faktúra bola plne schválená",
    isFullyApproved: true,
  }
}

/**
 * Reject the current step of an invoice.
 */
export async function rejectStep(
  db: SupabaseClient,
  invoiceId: string,
  userId: string,
  userRole: string,
  notes: string
): Promise<{ success: boolean; message: string }> {
  // Get current pending approval step
  const { data: currentApproval } = await (db.from("invoice_approvals") as any)
    .select("*")
    .eq("invoice_id", invoiceId)
    .eq("status", "pending")
    .order("step", { ascending: true })
    .limit(1)
    .single()

  if (!currentApproval) {
    return { success: false, message: "Žiadny krok na zamietnutie" }
  }

  const canReject = userRole === "admin" || userRole === currentApproval.required_role
  if (!canReject) {
    return { success: false, message: `Na zamietnutie je potrebná rola: ${currentApproval.required_role}` }
  }

  if (!notes) {
    return { success: false, message: "Dôvod zamietnutia je povinný" }
  }

  // Reject the step
  await (db.from("invoice_approvals") as any)
    .update({
      status: "rejected",
      actioned_by: userId,
      actioned_at: new Date().toISOString(),
      notes,
    })
    .eq("id", currentApproval.id)

  // Mark invoice as rejected
  await (db.from("invoices") as any)
    .update({ approval_status: "rejected" })
    .eq("id", invoiceId)

  return { success: true, message: "Faktúra bola zamietnutá" }
}

/**
 * Get approval status for an invoice.
 */
export async function getApprovalStatus(
  db: SupabaseClient,
  invoiceId: string,
  userRole: string
): Promise<ApprovalStatus | null> {
  const { data: approvals } = await (db.from("invoice_approvals") as any)
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("step", { ascending: true })

  if (!approvals || approvals.length === 0) {
    return null
  }

  const { data: invoice } = await (db.from("invoices") as any)
    .select("approval_status, current_approval_step")
    .eq("id", invoiceId)
    .single()

  const currentPending = approvals.find((a: any) => a.status === "pending")
  const canApprove = currentPending
    ? (userRole === "admin" || userRole === currentPending.required_role)
    : false

  const stepLabels: Record<string, string> = {
    fakturant: "Fakturant",
    uctovnik: "Účtovník",
    konatel: "Konateľ",
  }

  return {
    invoiceId,
    approvalStatus: invoice?.approval_status || "none",
    currentStep: invoice?.current_approval_step || 0,
    totalSteps: approvals.length,
    steps: approvals.map((a: any) => ({
      step: a.step,
      stepName: a.step_name,
      label: stepLabels[a.step_name] || a.step_name,
      status: a.status,
      actionedBy: a.actioned_by,
      actionedAt: a.actioned_at,
      notes: a.notes,
    })),
    canApprove,
    canReject: canApprove,
  }
}

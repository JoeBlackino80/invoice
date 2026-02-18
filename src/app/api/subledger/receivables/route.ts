import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/subledger/receivables - Odberateľské saldokonto
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const contactId = searchParams.get("contact_id")
  const status = searchParams.get("status")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  // Fetch outgoing invoices (vydané faktúry)
  let query = (db.from("invoices") as any)
    .select(`
      id,
      number,
      type,
      issue_date,
      due_date,
      total,
      paid_amount,
      currency,
      status,
      contact_id,
      contact:contacts(id, name, ico, email)
    `)
    .eq("company_id", companyId)
    .eq("type", "vydana")
    .is("deleted_at", null)
    .not("status", "eq", "stornovana")
    .not("status", "eq", "draft")
    .order("due_date", { ascending: true })

  if (contactId) {
    query = query.eq("contact_id", contactId)
  }

  // Filter by payment status
  if (status === "unpaid") {
    query = query.eq("paid_amount", 0)
  } else if (status === "partial") {
    query = query.gt("paid_amount", 0).neq("status", "uhradena")
  } else if (status === "overdue") {
    query = query.neq("status", "uhradena").lt("due_date", new Date().toISOString().split("T")[0])
  }

  const { data: invoices, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter to only unpaid/partially paid invoices (unless fully paid was explicitly wanted)
  const filteredInvoices = (invoices || []).filter((inv: any) => {
    const remaining = (Number(inv.total) || 0) - (Number(inv.paid_amount) || 0)
    return remaining > 0.01
  })

  // Group by contact
  const contactMap: Record<string, {
    contact_id: string
    name: string
    ico: string | null
    email: string | null
    total_receivable: number
    total_overdue: number
    invoice_count: number
    invoices: any[]
  }> = {}

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const inv of filteredInvoices) {
    const cId = inv.contact_id || "unknown"
    const contactName = inv.contact?.name || "Neznámy kontakt"
    const contactIco = inv.contact?.ico || null
    const contactEmail = inv.contact?.email || null

    if (!contactMap[cId]) {
      contactMap[cId] = {
        contact_id: cId,
        name: contactName,
        ico: contactIco,
        email: contactEmail,
        total_receivable: 0,
        total_overdue: 0,
        invoice_count: 0,
        invoices: [],
      }
    }

    const total = Number(inv.total) || 0
    const paidAmount = Number(inv.paid_amount) || 0
    const remaining = total - paidAmount
    const dueDate = new Date(inv.due_date)
    dueDate.setHours(0, 0, 0, 0)
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
    const isOverdue = daysOverdue > 0

    contactMap[cId].total_receivable += remaining
    if (isOverdue) {
      contactMap[cId].total_overdue += remaining
    }
    contactMap[cId].invoice_count += 1
    contactMap[cId].invoices.push({
      id: inv.id,
      number: inv.number,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      total,
      paid_amount: paidAmount,
      remaining,
      currency: inv.currency,
      status: inv.status,
      days_overdue: daysOverdue,
      is_overdue: isOverdue,
    })
  }

  // Convert map to sorted array
  const data = Object.values(contactMap).sort((a, b) => b.total_receivable - a.total_receivable)

  // Calculate totals
  let grand_total_receivable = 0
  let grand_total_overdue = 0
  let grand_invoice_count = 0

  for (const group of data) {
    grand_total_receivable += group.total_receivable
    grand_total_overdue += group.total_overdue
    grand_invoice_count += group.invoice_count
  }

  return NextResponse.json({
    data,
    summary: {
      total_receivable: grand_total_receivable,
      total_overdue: grand_total_overdue,
      total_contacts: data.length,
      total_invoices: grand_invoice_count,
    },
  })
}

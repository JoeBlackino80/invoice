import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  // Fetch recent invoices
  const { data: invoices } = await (db.from("invoices") as any)
    .select("id, number, type, total, status, due_date, issue_date, contact_id, variable_symbol, supplier_name, customer_name")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .limit(200) as { data: any[]; error: any }

  // Fetch contacts
  const { data: contacts } = await (db.from("contacts") as any)
    .select("id, name")
    .eq("company_id", companyId)
    .is("deleted_at", null) as { data: any[]; error: any }

  // Detect anomalies locally (without AI for basic checks)
  const anomalies: Array<{
    type: "warning" | "error" | "info"
    category: string
    title: string
    description: string
    invoice_id?: string
    invoice_number?: string
  }> = []

  const now = new Date()
  const invoiceList = invoices || []

  // 1. Overdue invoices
  const overdue = invoiceList.filter((inv: any) =>
    inv.status !== "uhradena" && inv.status !== "stornovana" && new Date(inv.due_date) < now
  )
  overdue.forEach((inv: any) => {
    const daysOverdue = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
    const contact = (contacts || []).find((c: any) => c.id === inv.contact_id)
    anomalies.push({
      type: daysOverdue > 90 ? "error" : "warning",
      category: "po_splatnosti",
      title: `Faktúra ${inv.number} po splatnosti ${daysOverdue} dní`,
      description: `${contact?.name || "Neznámy kontakt"} - ${inv.total} EUR, splatnosť ${inv.due_date}`,
      invoice_id: inv.id,
      invoice_number: inv.number,
    })
  })

  // 2. Duplicate detection (same amount + same contact within 7 days)
  for (let i = 0; i < invoiceList.length; i++) {
    for (let j = i + 1; j < invoiceList.length; j++) {
      const a = invoiceList[i]
      const b = invoiceList[j]
      if (
        a.total === b.total &&
        a.contact_id === b.contact_id &&
        a.contact_id &&
        a.type === b.type &&
        Math.abs(new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime()) < 7 * 24 * 60 * 60 * 1000
      ) {
        const contact = (contacts || []).find((c: any) => c.id === a.contact_id)
        anomalies.push({
          type: "warning",
          category: "duplicita",
          title: `Možná duplicitná faktúra: ${a.number} a ${b.number}`,
          description: `Rovnaká suma ${a.total} EUR pre ${contact?.name || "neznámy"} v rozmedzí 7 dní`,
          invoice_id: a.id,
          invoice_number: a.number,
        })
      }
    }
  }

  // 3. Unusually high amounts (3x above average)
  const amounts = invoiceList.map((inv: any) => inv.total).filter((t: number) => t > 0)
  if (amounts.length > 5) {
    const avg = amounts.reduce((s: number, a: number) => s + a, 0) / amounts.length
    invoiceList.forEach((inv: any) => {
      if (inv.total > avg * 3 && inv.total > 1000) {
        anomalies.push({
          type: "info",
          category: "vysoka_suma",
          title: `Neobvykle vysoká suma: ${inv.number}`,
          description: `${inv.total} EUR je ${(inv.total / avg).toFixed(1)}x vyššia ako priemer (${avg.toFixed(2)} EUR)`,
          invoice_id: inv.id,
          invoice_number: inv.number,
        })
      }
    })
  }

  // 4. Invoices older than 360 days still unpaid (need write-off consideration)
  const oldUnpaid = invoiceList.filter((inv: any) => {
    if (inv.status === "uhradena" || inv.status === "stornovana") return false
    const daysSinceIssue = Math.floor((now.getTime() - new Date(inv.issue_date).getTime()) / (1000 * 60 * 60 * 24))
    return daysSinceIssue > 360
  })
  oldUnpaid.forEach((inv: any) => {
    anomalies.push({
      type: "error",
      category: "stary_dlh",
      title: `Faktúra ${inv.number} staršia ako 360 dní - zvážte odpis`,
      description: `Neuhradená faktúra ${inv.total} EUR z ${inv.issue_date}. Podľa zákona o dani z príjmov zvážte tvorbu opravnej položky.`,
      invoice_id: inv.id,
      invoice_number: inv.number,
    })
  })

  return NextResponse.json({
    anomalies,
    summary: {
      total: anomalies.length,
      errors: anomalies.filter(a => a.type === "error").length,
      warnings: anomalies.filter(a => a.type === "warning").length,
      info: anomalies.filter(a => a.type === "info").length,
    },
  })
}

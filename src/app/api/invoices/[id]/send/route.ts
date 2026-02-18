import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email/send"
import { invoiceEmailTemplate } from "@/lib/email/templates"

// POST /api/invoices/:id/send - Send invoice via email to the contact
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Fetch invoice with contact details
  const { data: invoice, error: invoiceError } = await db
    .from("invoices")
    .select(`
      *,
      contact:contacts (
        id,
        name,
        email
      )
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 })
  }

  // Check that invoice has a contact with an email
  const contactEmail = invoice.contact?.email
  if (!contactEmail) {
    return NextResponse.json(
      { error: "Kontakt faktúry nemá zadanú emailovú adresu" },
      { status: 400 }
    )
  }

  // Fetch company details
  const { data: company, error: companyError } = await db
    .from("companies")
    .select("id, name, ico, email, phone")
    .eq("id", invoice.company_id)
    .single() as { data: any; error: any }

  if (companyError || !company) {
    return NextResponse.json({ error: "Spoločnosť nenájdená" }, { status: 500 })
  }

  // Generate email HTML
  const html = invoiceEmailTemplate(invoice, company)

  // Send the email
  const result = await sendEmail({
    to: contactEmail,
    subject: `Faktúra č. ${invoice.number} od ${company.name}`,
    html,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: "Nepodarilo sa odoslať email", details: result.error },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    message: `Faktúra bola odoslaná na ${contactEmail}`,
    dev: (result as any).dev || false,
  })
}

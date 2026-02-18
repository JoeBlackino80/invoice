import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendInvoiceEmail } from "@/lib/notifications/email-sender"

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

  try {
    // Queue the email for reliable delivery
    const queueId = await sendInvoiceEmail({
      invoice: {
        id: invoice.id,
        number: invoice.number,
        total: invoice.total_amount || invoice.total || 0,
        currency: invoice.currency,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        customer_name: invoice.customer_name,
        contact: invoice.contact,
      },
      company: {
        id: company.id,
        name: company.name,
        email: company.email,
        phone: company.phone,
      },
      recipientEmail: contactEmail,
    })

    // Update invoice status to sent
    await db
      .from("invoices")
      .update({ status: "odoslana" })
      .eq("id", invoice.id)

    return NextResponse.json({
      success: true,
      message: `Faktúra bola zaradená na odoslanie na ${contactEmail}`,
      queueId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznáma chyba"
    return NextResponse.json(
      { error: "Nepodarilo sa zaradiť email do fronty", details: message },
      { status: 500 }
    )
  }
}

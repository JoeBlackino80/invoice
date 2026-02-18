import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/documents/:id/create-invoice - create invoice from OCR data
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  // Fetch document with OCR results
  const { data: document, error: docError } = await (db
    .from("documents") as any)
    .select(`
      *,
      document_ocr_results (*)
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (docError || !document) {
    return NextResponse.json({ error: "Dokument nenajdeny" }, { status: 404 })
  }

  // Get the latest OCR result
  const ocrResults = document.document_ocr_results
  if (!ocrResults || ocrResults.length === 0) {
    return NextResponse.json(
      { error: "Dokument nema OCR vysledky. Najprv spustite OCR spracovanie." },
      { status: 400 }
    )
  }

  const latestOcr = ocrResults[ocrResults.length - 1]
  const ocrData = latestOcr.extracted_data

  // Auto-lookup or create contact by ICO
  let contactId: string | null = null

  if (ocrData.supplier_ico) {
    // Try to find existing contact by ICO
    const { data: existingContact } = await (db
      .from("contacts") as any)
      .select("id")
      .eq("company_id", company_id)
      .eq("ico", ocrData.supplier_ico)
      .is("deleted_at", null)
      .single() as { data: any; error: any }

    if (existingContact) {
      contactId = existingContact.id
    } else {
      // Create a new contact from OCR supplier data
      const { data: newContact, error: contactError } = await (db
        .from("contacts") as any)
        .insert({
          company_id,
          name: ocrData.supplier_name || "Neznamy dodavatel",
          type: "dodavatel",
          ico: ocrData.supplier_ico || null,
          dic: ocrData.supplier_dic || null,
          ic_dph: ocrData.supplier_ic_dph || null,
          street: ocrData.supplier_street || null,
          city: ocrData.supplier_city || null,
          zip: ocrData.supplier_zip || null,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single() as { data: any; error: any }

      if (!contactError && newContact) {
        contactId = newContact.id

        // If IBAN is available, create bank account for the contact
        if (ocrData.supplier_iban) {
          await (db.from("contact_bank_accounts") as any)
            .insert({
              contact_id: newContact.id,
              iban: ocrData.supplier_iban,
              bic: ocrData.supplier_bic || null,
              is_default: true,
              created_by: user.id,
            })
        }
      }
    }
  }

  // Generate invoice number for prijata faktura
  const { data: invoiceNumber, error: numberError } = await (db
    .rpc as any)("generate_next_number", {
      p_company_id: company_id,
      p_type: "faktura_prijata",
    })

  if (numberError) {
    return NextResponse.json({ error: numberError.message }, { status: 500 })
  }

  // Create the invoice as prijata faktura
  const { data: invoice, error: invoiceError } = await (db
    .from("invoices") as any)
    .insert({
      company_id,
      type: "prijata",
      status: "draft",
      number: invoiceNumber,
      contact_id: contactId,
      supplier_name: ocrData.supplier_name || null,
      supplier_ico: ocrData.supplier_ico || null,
      supplier_dic: ocrData.supplier_dic || null,
      supplier_ic_dph: ocrData.supplier_ic_dph || null,
      supplier_street: ocrData.supplier_street || null,
      supplier_city: ocrData.supplier_city || null,
      supplier_zip: ocrData.supplier_zip || null,
      issue_date: ocrData.issue_date || new Date().toISOString().split("T")[0],
      delivery_date: ocrData.delivery_date || ocrData.issue_date || new Date().toISOString().split("T")[0],
      due_date: ocrData.due_date || null,
      currency: ocrData.currency || "EUR",
      exchange_rate: 1,
      variable_symbol: ocrData.variable_symbol || null,
      constant_symbol: ocrData.constant_symbol || null,
      specific_symbol: ocrData.specific_symbol || null,
      document_id: params.id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 500 })
  }

  // Insert invoice items from OCR data
  const ocrItems = ocrData.items || []
  if (ocrItems.length > 0) {
    const itemsToInsert = ocrItems.map((item: any, index: number) => ({
      company_id,
      invoice_id: invoice.id,
      position: index,
      description: item.description || "Polozka",
      quantity: item.quantity || 1,
      unit: item.unit || "ks",
      unit_price: item.unit_price || 0,
      vat_rate: item.vat_rate || 23,
    }))

    const { data: insertedItems, error: itemsError } = await (db
      .from("invoice_items") as any)
      .insert(itemsToInsert)
      .select()

    if (itemsError) {
      // Rollback: delete the invoice
      await (db.from("invoices") as any).delete().eq("id", invoice.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Update document to link to the created invoice
    await (db.from("documents") as any)
      .update({ invoice_id: invoice.id, updated_by: user.id })
      .eq("id", params.id)

    return NextResponse.json(
      {
        ...invoice,
        items: insertedItems,
        contact_id: contactId,
      },
      { status: 201 }
    )
  }

  // Update document to link to the created invoice
  await (db.from("documents") as any)
    .update({ invoice_id: invoice.id, updated_by: user.id })
    .eq("id", params.id)

  return NextResponse.json(
    {
      ...invoice,
      items: [],
      contact_id: contactId,
    },
    { status: 201 }
  )
}

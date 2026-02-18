import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { renderToBuffer } from "@react-pdf/renderer"
import { InvoicePDF } from "@/lib/pdf/invoice-pdf"
import { generatePayBySquareQR } from "@/lib/pay-by-square"
import React from "react"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Načítať faktúru s položkami
  const { data: invoice, error } = await db
    .from("invoices")
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error || !invoice) {
    return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 })
  }

  const { data: items } = await db
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", params.id)
    .order("position") as { data: any[]; error: any }

  // Generovať QR kód pre platbu (len pre odoslané faktúry)
  let qrDataUrl: string | undefined
  if (invoice.type === "vydana" && invoice.supplier_iban && invoice.total > 0) {
    try {
      qrDataUrl = await generatePayBySquareQR({
        amount: invoice.total,
        currency: invoice.currency || "EUR",
        iban: invoice.supplier_iban.replace(/\s/g, ""),
        bic: invoice.supplier_bic || undefined,
        variableSymbol: invoice.variable_symbol || undefined,
        constantSymbol: invoice.constant_symbol || undefined,
        recipientName: invoice.supplier_name || "",
        dueDate: invoice.due_date,
        note: `Faktúra ${invoice.number}`,
      })
    } catch {
      // QR kód je voliteľný
    }
  }

  // Renderovať PDF
  const pdfBuffer = await renderToBuffer(
    React.createElement(InvoicePDF, {
      invoice,
      items: items || [],
      qrDataUrl,
    }) as any
  )

  return new NextResponse(Buffer.from(pdfBuffer) as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="faktura-${invoice.number}.pdf"`,
    },
  })
}

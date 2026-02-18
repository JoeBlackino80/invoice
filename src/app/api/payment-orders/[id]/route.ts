import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/payment-orders/:id - detail platobneho prikazu
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { data: order, error } = await (db
    .from("payment_orders") as any)
    .select(`
      *,
      bank_account:bank_accounts(id, name, iban, bic, currency)
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error || !order) {
    return NextResponse.json({ error: "Platobny prikaz nebol najdeny" }, { status: 404 })
  }

  // Parse payment items from SEPA XML for display
  const items = parsePaymentsFromXml(order.sepa_xml || "")

  return NextResponse.json({
    ...order,
    items,
  })
}

// DELETE /api/payment-orders/:id - soft delete (iba ak status=nova)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Fetch the order to check status
  const { data: order, error: fetchError } = await (db
    .from("payment_orders") as any)
    .select("id, status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !order) {
    return NextResponse.json({ error: "Platobny prikaz nebol najdeny" }, { status: 404 })
  }

  if (order.status !== "nova") {
    return NextResponse.json(
      { error: "Odstranit je mozne iba prikazy v stave 'Nova'" },
      { status: 400 }
    )
  }

  const { error: deleteError } = await (db
    .from("payment_orders") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/**
 * Parse payment items from SEPA XML for display purposes.
 * Extracts creditor name, IBAN, amount, and remittance info.
 */
function parsePaymentsFromXml(xml: string): any[] {
  if (!xml) return []

  const items: any[] = []

  // Simple regex-based XML parsing for display purposes
  const txBlocks = xml.split("<CdtTrfTxInf>").slice(1)

  for (const block of txBlocks) {
    const endToEndId = extractTag(block, "EndToEndId")
    const amount = extractTag(block, "InstdAmt")
    const currency = extractAttribute(block, "InstdAmt", "Ccy")
    const creditorName = extractTagAfter(block, "<Cdtr>", "Nm")
    const creditorIban = extractTagAfter(block, "<CdtrAcct>", "IBAN")
    const bic = extractTagAfter(block, "<CdtrAgt>", "BIC")
    const remittanceInfo = extractTag(block, "Ustrd")

    // Parse VS/KS/SS from remittance info
    const vs = remittanceInfo?.match(/\/VS(\d+)/)?.[1] || ""
    const ks = remittanceInfo?.match(/\/KS(\d+)/)?.[1] || ""
    const ss = remittanceInfo?.match(/\/SS(\d+)/)?.[1] || ""

    items.push({
      id: endToEndId || "",
      amount: amount ? parseFloat(amount) : 0,
      currency: currency || "EUR",
      creditor_name: creditorName || "",
      creditor_iban: creditorIban || "",
      creditor_bic: bic || "",
      variable_symbol: vs,
      constant_symbol: ks,
      specific_symbol: ss,
      remittance_info: remittanceInfo || "",
    })
  }

  return items
}

function extractTag(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`)
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

function extractAttribute(xml: string, tagName: string, attrName: string): string | null {
  const regex = new RegExp(`<${tagName}\\s+${attrName}="([^"]+)"`)
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

function extractTagAfter(xml: string, parentStart: string, tagName: string): string | null {
  const parentIdx = xml.indexOf(parentStart)
  if (parentIdx === -1) return null
  const sub = xml.substring(parentIdx)
  return extractTag(sub, tagName)
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import Anthropic from "@anthropic-ai/sdk"

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { company_id, ocr_data, invoice_id } = await request.json()

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  // Get chart of accounts for this company
  const { data: accounts } = await (db.from("chart_of_accounts") as any)
    .select("code, name, type, is_active")
    .eq("company_id", company_id)
    .eq("is_active", true)
    .order("code") as { data: any[]; error: any }

  // Get recent journal entries for learning
  const { data: recentEntries } = await (db.from("journal_entries") as any)
    .select(`
      description,
      journal_entry_lines (
        account_id,
        debit_amount,
        credit_amount,
        description
      )
    `)
    .eq("company_id", company_id)
    .order("date", { ascending: false })
    .limit(50) as { data: any[]; error: any }

  // If invoice_id provided, get invoice data
  let invoiceData = ocr_data
  if (invoice_id) {
    const { data: invoice } = await db
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("id", invoice_id)
      .single() as { data: any; error: any }
    if (invoice) {
      invoiceData = {
        supplier_name: invoice.supplier_name || invoice.customer_name,
        document_type: invoice.type,
        total: invoice.total,
        items: invoice.invoice_items?.map((i: any) => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          vat_rate: i.vat_rate,
        })),
      }
    }
  }

  const accountsList = (accounts || []).map((a: any) => `${a.code} - ${a.name} (${a.type})`).join("\n")

  const recentExamples = (recentEntries || []).slice(0, 20).map((e: any) => {
    const lines = (e.journal_entry_lines || []).map((l: any) => {
      const acc = (accounts || []).find((a: any) => a.id === l.account_id)
      return `  ${acc?.code || "?"}: MD ${l.debit_amount || 0} / D ${l.credit_amount || 0} - ${l.description || ""}`
    }).join("\n")
    return `${e.description}:\n${lines}`
  }).join("\n\n")

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `Si expert na slovenské podvojné účtovníctvo. Na základe dokladu navrhni predkontáciu (účtovné zápisy MD/D).

Účtová osnova firmy:
${accountsList || "Štandardná slovenská účtová osnova"}

Príklady predchádzajúcich zápisov:
${recentExamples || "žiadne predchádzajúce zápisy"}

Vráť odpoveď VÝHRADNE ako JSON:
{
  "entries": [
    {
      "account_code": "321",
      "account_name": "Dodávatelia",
      "debit": 0,
      "credit": 1200.00,
      "description": "Faktúra za služby"
    },
    {
      "account_code": "518",
      "account_name": "Ostatné služby",
      "debit": 1000.00,
      "credit": 0,
      "description": "Služby - základ"
    },
    {
      "account_code": "343",
      "account_name": "DPH",
      "debit": 200.00,
      "credit": 0,
      "description": "DPH 20%"
    }
  ],
  "confidence": 0.85,
  "reasoning": "Faktúra za služby od dodávateľa, štandardné účtovanie prijatej faktúry."
}`,
    messages: [
      {
        role: "user",
        content: `Navrhni predkontáciu pre tento doklad:\n${JSON.stringify(invoiceData, null, 2)}`,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === "text")
  if (!textContent || textContent.type !== "text") {
    return NextResponse.json({ error: "Nepodarilo sa získať odpoveď" }, { status: 500 })
  }

  let jsonStr = textContent.text.trim()
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }

  try {
    const result = JSON.parse(jsonStr)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({
      entries: [],
      confidence: 0,
      reasoning: textContent.text,
    })
  }
}

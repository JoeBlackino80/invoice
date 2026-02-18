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

  const { message, company_id, history } = await request.json()

  if (!message || !company_id) {
    return NextResponse.json({ error: "message a company_id sú povinné" }, { status: 400 })
  }

  // Fetch company context data
  // Get company info
  const { data: company } = await db
    .from("companies")
    .select("name, ico, dic, ic_dph, accounting_type, is_vat_payer")
    .eq("id", company_id)
    .single() as { data: any; error: any }

  // Get summary stats - use (db.from(...) as any) pattern for all queries
  // Invoices summary
  const { data: invoicesIssued } = await (db.from("invoices") as any)
    .select("id, number, total, status, due_date, type, contact_id")
    .eq("company_id", company_id)
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .limit(100) as { data: any[]; error: any }

  // Contacts
  const { data: contacts } = await (db.from("contacts") as any)
    .select("id, name, ico, type")
    .eq("company_id", company_id)
    .is("deleted_at", null)
    .limit(200) as { data: any[]; error: any }

  // Build context about the company
  const overdueInvoices = (invoicesIssued || []).filter((inv: any) =>
    inv.status !== "uhradena" && inv.status !== "stornovana" && new Date(inv.due_date) < new Date()
  )

  const totalReceivables = (invoicesIssued || [])
    .filter((inv: any) => inv.type === "vydana" && inv.status !== "uhradena" && inv.status !== "stornovana")
    .reduce((sum: number, inv: any) => sum + (inv.total || 0), 0)

  const totalPayables = (invoicesIssued || [])
    .filter((inv: any) => inv.type === "prijata" && inv.status !== "uhradena" && inv.status !== "stornovana")
    .reduce((sum: number, inv: any) => sum + (inv.total || 0), 0)

  const contextData = `
Informácie o firme:
- Názov: ${company?.name || "neznámy"}
- IČO: ${company?.ico || "neuvedené"}
- Typ účtovníctva: ${company?.accounting_type || "neuvedené"}
- Platiteľ DPH: ${company?.is_vat_payer ? "Áno" : "Nie"}

Štatistiky:
- Celkom faktúr: ${(invoicesIssued || []).length}
- Pohľadávky (nezaplatené vydané faktúry): ${totalReceivables.toFixed(2)} EUR
- Záväzky (nezaplatené prijaté faktúry): ${totalPayables.toFixed(2)} EUR
- Faktúry po splatnosti: ${overdueInvoices.length}
- Kontakty: ${(contacts || []).length}

Posledné faktúry:
${(invoicesIssued || []).slice(0, 20).map((inv: any) => {
  const contact = (contacts || []).find((c: any) => c.id === inv.contact_id)
  return `- ${inv.number} | ${inv.type} | ${inv.total} EUR | ${inv.status} | ${contact?.name || "bez kontaktu"} | splatnosť: ${inv.due_date}`
}).join("\n")}

Kontakty s faktúrami po splatnosti:
${overdueInvoices.slice(0, 10).map((inv: any) => {
  const contact = (contacts || []).find((c: any) => c.id === inv.contact_id)
  return `- ${contact?.name || "neznámy"}: ${inv.number} | ${inv.total} EUR | splatnosť: ${inv.due_date}`
}).join("\n") || "žiadne"}
`

  const systemPrompt = `Si inteligentný účtovný asistent pre slovenské firmy. Máš prístup k údajom firmy a odpovedáš na otázky o účtovníctve, faktúrach, financiách a daňových povinnostiach.

${contextData}

Pravidlá:
- Odpovedaj vždy po slovensky
- Buď stručný a vecný
- Ak nemáš dostatok údajov, povedz to
- Používaj konkrétne čísla z údajov vyššie
- Sumy uvádzaj v EUR s 2 desatinnými miestami
- Dátumy uvádzaj vo formáte DD.MM.YYYY
- Ak sa pýtajú na niečo čo nevieš, odporuč im konkrétnu sekciu v aplikácii`

  // Build message history for Claude
  const messages: Anthropic.MessageParam[] = [
    ...(history || []).map((h: any) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: message },
  ]

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  })

  const textContent = response.content.find((c) => c.type === "text")
  const reply = textContent && textContent.type === "text" ? textContent.text : "Prepáčte, nepodarilo sa spracovať odpoveď."

  return NextResponse.json({ reply })
}

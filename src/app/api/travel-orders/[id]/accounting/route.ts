import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  generateTravelAccountingEntries,
  type TravelOrderData,
  type TravelSettlementData,
} from "@/lib/travel/travel-accounting"

// POST /api/travel-orders/:id/accounting - zauctovanie cestovneho prikazu
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  const body = await request.json()
  const { payment_method } = body as { payment_method?: "cash" | "bank" }

  if (!payment_method || (payment_method !== "cash" && payment_method !== "bank")) {
    return NextResponse.json(
      { error: "Neplatny sposob platby. Povolene: cash, bank" },
      { status: 400 }
    )
  }

  // 1. Nacitanie cestovneho prikazu
  const { data: travelOrder, error: orderError } = await (db
    .from("travel_orders") as any)
    .select("*")
    .eq("id", params.id)
    .single() as { data: any; error: any }

  if (orderError || !travelOrder) {
    return NextResponse.json(
      { error: "Cestovny prikaz nebol najdeny" },
      { status: 404 }
    )
  }

  // 2. Validacia stavu
  if (travelOrder.status !== "settled") {
    return NextResponse.json(
      {
        error:
          "Cestovny prikaz musi byt v stave 'vyuctovany' pre zauctovanie. Aktualny stav: " +
          travelOrder.status,
      },
      { status: 400 }
    )
  }

  // 3. Nacitanie vyuctovania
  const { data: settlement, error: settlementError } = await (db
    .from("travel_settlements") as any)
    .select("*")
    .eq("travel_order_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single() as { data: any; error: any }

  if (settlementError || !settlement) {
    return NextResponse.json(
      { error: "Vyuctovanie cestovneho prikazu nebolo najdene" },
      { status: 404 }
    )
  }

  // 4. Generovanie uctovnych zapisov
  const orderData: TravelOrderData = {
    id: travelOrder.id,
    employee_name: travelOrder.employee_name || "Zamestnanec",
    destination: travelOrder.destination,
    purpose: travelOrder.purpose,
    date_from: travelOrder.date_from,
    date_to: travelOrder.date_to,
    is_foreign: travelOrder.is_foreign || false,
    currency: travelOrder.currency,
    exchange_rate: travelOrder.exchange_rate,
  }

  const settlementData: TravelSettlementData = {
    id: settlement.id,
    travel_order_id: settlement.travel_order_id,
    meal_allowance: settlement.meal_allowance || 0,
    transport_cost: settlement.transport_cost || 0,
    accommodation_cost: settlement.accommodation_cost || 0,
    other_costs: settlement.other_costs || 0,
    total_expenses: settlement.total_expenses || 0,
    advance_amount: travelOrder.advance_amount || 0,
    difference:
      (settlement.total_expenses || 0) - (travelOrder.advance_amount || 0),
    currency: settlement.currency || "EUR",
    exchange_rate: settlement.exchange_rate,
    foreign_amount: settlement.foreign_amount,
    foreign_currency: settlement.foreign_currency,
  }

  const accountingEntries = generateTravelAccountingEntries(
    orderData,
    settlementData,
    payment_method
  )

  // 5. Generovanie cisla dokladu
  const { data: documentNumber, error: numberError } = await (db.rpc as any)(
    "generate_next_number",
    {
      p_company_id: travelOrder.company_id,
      p_type: "uctovny_zapis_ID",
    }
  )

  if (numberError) {
    return NextResponse.json(
      { error: "Nepodarilo sa vygenerovat cislo dokladu: " + numberError.message },
      { status: 500 }
    )
  }

  // 6. Vytvorenie hlavicky uctovneho zapisu
  const totalMD = accountingEntries.reduce((sum, e) => sum + e.amount, 0)

  const { data: journalEntry, error: entryError } = await (db
    .from("journal_entries") as any)
    .insert({
      company_id: travelOrder.company_id,
      number: documentNumber || `CP-${params.id.substring(0, 8)}`,
      document_type: "ID",
      date: settlement.settlement_date || new Date().toISOString().split("T")[0],
      description: `Cestovne nahrady - ${travelOrder.destination} (${travelOrder.employee_name || "Zamestnanec"})`,
      source_document_id: travelOrder.id,
      status: "draft",
      total_md: totalMD,
      total_d: totalMD,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (entryError) {
    return NextResponse.json(
      { error: "Nepodarilo sa vytvorit uctovny zapis: " + entryError.message },
      { status: 500 }
    )
  }

  // 7. Najst account IDs podla syntetickych uctov
  const accountCodes = Array.from(
    new Set(
      accountingEntries.flatMap((e) => [e.debit_account, e.credit_account])
    )
  )

  const { data: accounts, error: accountsError } = await (db
    .from("chart_of_accounts") as any)
    .select("id, synteticky_ucet")
    .eq("company_id", travelOrder.company_id)
    .in("synteticky_ucet", accountCodes)

  if (accountsError) {
    // Rollback: vymazat hlavicku
    await (db.from("journal_entries") as any)
      .delete()
      .eq("id", journalEntry.id)
    return NextResponse.json(
      { error: "Nepodarilo sa najst ucty: " + accountsError.message },
      { status: 500 }
    )
  }

  const accountMap: Record<string, string> = {}
  if (accounts) {
    for (const acc of accounts) {
      accountMap[acc.synteticky_ucet] = acc.id
    }
  }

  // Kontrola ci vsetky ucty existuju
  const missingAccounts = accountCodes.filter((code) => !accountMap[code])
  if (missingAccounts.length > 0) {
    await (db.from("journal_entries") as any)
      .delete()
      .eq("id", journalEntry.id)
    return NextResponse.json(
      {
        error: `Chybajuce ucty v uctovnom rozvrhu: ${missingAccounts.join(", ")}. Najprv ich pridajte do uctovneho rozvrhu.`,
      },
      { status: 400 }
    )
  }

  // 8. Vytvorenie riadkov uctovneho zapisu
  const lines: Array<{
    company_id: string
    journal_entry_id: string
    position: number
    account_id: string
    side: string
    amount: number
    currency: string
    description: string | null
  }> = []

  accountingEntries.forEach((entry, index) => {
    // MD strana (debit)
    lines.push({
      company_id: travelOrder.company_id,
      journal_entry_id: journalEntry.id,
      position: index * 2,
      account_id: accountMap[entry.debit_account],
      side: "MD",
      amount: entry.amount,
      currency: entry.currency,
      description: entry.description,
    })
    // D strana (credit)
    lines.push({
      company_id: travelOrder.company_id,
      journal_entry_id: journalEntry.id,
      position: index * 2 + 1,
      account_id: accountMap[entry.credit_account],
      side: "D",
      amount: entry.amount,
      currency: entry.currency,
      description: entry.description,
    })
  })

  const { data: insertedLines, error: linesError } = await (db
    .from("journal_entry_lines") as any)
    .insert(lines)
    .select()

  if (linesError) {
    await (db.from("journal_entries") as any)
      .delete()
      .eq("id", journalEntry.id)
    return NextResponse.json(
      { error: "Nepodarilo sa vytvorit riadky uctovneho zapisu: " + linesError.message },
      { status: 500 }
    )
  }

  // 9. Aktualizacia stavu cestovneho prikazu
  await (db.from("travel_orders") as any)
    .update({
      status: "accounted",
      journal_entry_id: journalEntry.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)

  return NextResponse.json(
    {
      journal_entry: {
        ...journalEntry,
        lines: insertedLines,
      },
      accounting_entries: accountingEntries,
    },
    { status: 201 }
  )
}

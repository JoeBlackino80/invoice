import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const PRESET_PREDKONTACIE = [
  {
    name: "Nakup materialu",
    document_type: "PFA",
    description: "Standardna predkontacia pre nakup materialu s DPH",
    lines: [
      { account_synteticky: "501", side: "MD", is_amount_field: true, percentage: 100, description: "Spotreba materialu" },
      { account_synteticky: "343", side: "MD", is_amount_field: true, percentage: 20, description: "DPH na vstupe" },
      { account_synteticky: "321", side: "D", is_amount_field: true, percentage: 120, description: "Dodavatelia" },
    ],
  },
  {
    name: "Nakup sluzieb",
    document_type: "PFA",
    description: "Standardna predkontacia pre nakup sluzieb s DPH",
    lines: [
      { account_synteticky: "518", side: "MD", is_amount_field: true, percentage: 100, description: "Ostatne sluzby" },
      { account_synteticky: "343", side: "MD", is_amount_field: true, percentage: 20, description: "DPH na vstupe" },
      { account_synteticky: "321", side: "D", is_amount_field: true, percentage: 120, description: "Dodavatelia" },
    ],
  },
  {
    name: "Predaj tovaru",
    document_type: "FA",
    description: "Standardna predkontacia pre predaj tovaru s DPH",
    lines: [
      { account_synteticky: "311", side: "MD", is_amount_field: true, percentage: 120, description: "Odberatelia" },
      { account_synteticky: "604", side: "D", is_amount_field: true, percentage: 100, description: "Trzby za tovar" },
      { account_synteticky: "343", side: "D", is_amount_field: true, percentage: 20, description: "DPH na vystupe" },
    ],
  },
  {
    name: "Predaj sluzieb",
    document_type: "FA",
    description: "Standardna predkontacia pre predaj sluzieb s DPH",
    lines: [
      { account_synteticky: "311", side: "MD", is_amount_field: true, percentage: 120, description: "Odberatelia" },
      { account_synteticky: "602", side: "D", is_amount_field: true, percentage: 100, description: "Trzby z predaja sluzieb" },
      { account_synteticky: "343", side: "D", is_amount_field: true, percentage: 20, description: "DPH na vystupe" },
    ],
  },
  {
    name: "Mzdy - hruba mzda",
    document_type: "ID",
    description: "Zauctovanie hrubej mzdy",
    lines: [
      { account_synteticky: "521", side: "MD", is_amount_field: true, percentage: 100, description: "Mzdove naklady" },
      { account_synteticky: "331", side: "D", is_amount_field: true, percentage: 100, description: "Zamestnanci" },
    ],
  },
  {
    name: "Mzdy - odvody zamestnavatela",
    document_type: "ID",
    description: "Zauctovanie odvodov zamestnavatela",
    lines: [
      { account_synteticky: "524", side: "MD", is_amount_field: true, percentage: 100, description: "Zakonny socialny poistenie" },
      { account_synteticky: "336", side: "D", is_amount_field: true, percentage: 100, description: "Zuctovanie so SP a ZP" },
    ],
  },
  {
    name: "Odpisy",
    document_type: "ID",
    description: "Zauctovanie odpisov dlhodobeho majetku",
    lines: [
      { account_synteticky: "551", side: "MD", is_amount_field: true, percentage: 100, description: "Odpisy DNM a DHM" },
      { account_synteticky: "08x", side: "D", is_amount_field: true, percentage: 100, description: "Opravky k DHM" },
    ],
  },
  {
    name: "Bankove poplatky",
    document_type: "BV",
    description: "Zauctovanie bankovych poplatkov",
    lines: [
      { account_synteticky: "568", side: "MD", is_amount_field: true, percentage: 100, description: "Ostatne financne naklady" },
      { account_synteticky: "221", side: "D", is_amount_field: true, percentage: 100, description: "Bankove ucty" },
    ],
  },
  {
    name: "Uroky prijate",
    document_type: "BV",
    description: "Zauctovanie prijatych urokov",
    lines: [
      { account_synteticky: "221", side: "MD", is_amount_field: true, percentage: 100, description: "Bankove ucty" },
      { account_synteticky: "662", side: "D", is_amount_field: true, percentage: 100, description: "Uroky" },
    ],
  },
  {
    name: "Uroky zaplatene",
    document_type: "BV",
    description: "Zauctovanie zaplatenych urokov",
    lines: [
      { account_synteticky: "562", side: "MD", is_amount_field: true, percentage: 100, description: "Uroky" },
      { account_synteticky: "221", side: "D", is_amount_field: true, percentage: 100, description: "Bankove ucty" },
    ],
  },
  {
    name: "Nakup PHM",
    document_type: "PFA",
    description: "Zauctovanie nakupu pohonnych hmot s DPH",
    lines: [
      { account_synteticky: "501", side: "MD", is_amount_field: true, percentage: 100, description: "Spotreba materialu - PHM" },
      { account_synteticky: "343", side: "MD", is_amount_field: true, percentage: 20, description: "DPH na vstupe" },
      { account_synteticky: "321", side: "D", is_amount_field: true, percentage: 120, description: "Dodavatelia" },
    ],
  },
  {
    name: "Najomne",
    document_type: "PFA",
    description: "Zauctovanie najomneho s DPH",
    lines: [
      { account_synteticky: "518", side: "MD", is_amount_field: true, percentage: 100, description: "Najomne" },
      { account_synteticky: "343", side: "MD", is_amount_field: true, percentage: 20, description: "DPH na vstupe" },
      { account_synteticky: "321", side: "D", is_amount_field: true, percentage: 120, description: "Dodavatelia" },
    ],
  },
  {
    name: "Energie",
    document_type: "PFA",
    description: "Zauctovanie energii s DPH",
    lines: [
      { account_synteticky: "502", side: "MD", is_amount_field: true, percentage: 100, description: "Spotreba energie" },
      { account_synteticky: "343", side: "MD", is_amount_field: true, percentage: 20, description: "DPH na vstupe" },
      { account_synteticky: "321", side: "D", is_amount_field: true, percentage: 120, description: "Dodavatelia" },
    ],
  },
  {
    name: "Pokladna prijem",
    document_type: "PPD",
    description: "Prijmovy pokladnicny doklad",
    lines: [
      { account_synteticky: "211", side: "MD", is_amount_field: true, percentage: 100, description: "Pokladnica" },
      { account_synteticky: "xxx", side: "D", is_amount_field: true, percentage: 100, description: "Protiucet (doplnit)" },
    ],
  },
  {
    name: "Pokladna vydaj",
    document_type: "VPD",
    description: "Vydavkovy pokladnicny doklad",
    lines: [
      { account_synteticky: "xxx", side: "MD", is_amount_field: true, percentage: 100, description: "Protiucet (doplnit)" },
      { account_synteticky: "211", side: "D", is_amount_field: true, percentage: 100, description: "Pokladnica" },
    ],
  },
]

// POST /api/predkontacie/seed - seed standardnych predkontacii pre firmu
export async function POST(request: Request) {
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

  // Check if predkontacie already exist for this company
  const { data: existingData, error: checkError } = await (db
    .from("predkontacie") as any)
    .select("id", { count: "exact" })
    .eq("company_id", company_id)
    .is("deleted_at", null)

  if (checkError) {
    return NextResponse.json({ error: checkError.message }, { status: 500 })
  }

  if (existingData && existingData.length > 0) {
    return NextResponse.json({
      error: "Pre tuto firmu uz existuju predkontacie (" + existingData.length + "). Ak chcete pridat standardne predkontacie, najprv odstranite existujuce."
    }, { status: 400 })
  }

  // Insert all preset predkontacie
  const recordsToInsert = PRESET_PREDKONTACIE.map((p) => ({
    company_id,
    name: p.name,
    document_type: p.document_type,
    description: p.description,
    lines: p.lines,
    created_by: user.id,
    updated_by: user.id,
  }))

  const { data: inserted, error: insertError } = await (db
    .from("predkontacie") as any)
    .insert(recordsToInsert)
    .select()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    message: "Uspesne vytvorene " + inserted.length + " standardnych predkontacii",
    data: inserted,
    count: inserted.length,
  }, { status: 201 })
}

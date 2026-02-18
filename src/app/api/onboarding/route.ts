import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { companySchema } from "@/lib/validations/company"

export async function POST(request: Request) {
  // Verify the user is authenticated using their session
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = companySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  // Use admin client (service role) to bypass RLS for onboarding
  const admin = createAdminClient()

  try {
    // 1. Create company
    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({
        name: data.name,
        ico: data.ico || null,
        dic: data.dic || null,
        ic_dph: data.ic_dph || null,
        street: data.street || null,
        city: data.city || null,
        zip: data.zip || null,
        country: data.country || "SK",
        email: data.email || null,
        phone: data.phone || null,
        web: data.web || null,
        iban: data.iban || null,
        bic: data.bic || null,
        bank_name: data.bank_name || null,
        business_type: data.business_type || "sro",
        accounting_type: data.accounting_type || "podvojne",
        size_category: data.size_category || "mikro",
        is_vat_payer: data.is_vat_payer || false,
        vat_period: data.vat_period || null,
        registration_court: data.registration_court || null,
        section_insert: data.section_insert || null,
        created_by: user.id,
      })
      .select("id, name")
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: companyError?.message || "Firma nebola vytvorená" },
        { status: 500 }
      )
    }

    // 2. Assign admin role (this would fail with anon key due to RLS)
    const { error: roleError } = await admin
      .from("user_company_roles")
      .insert({
        user_id: user.id,
        company_id: company.id,
        role: "admin",
        is_default: true,
      })

    if (roleError) {
      // Rollback: delete company
      await admin.from("companies").delete().eq("id", company.id)
      return NextResponse.json({ error: roleError.message }, { status: 500 })
    }

    // 3. Create default settings
    const { error: settingsError } = await admin
      .from("company_settings")
      .insert({
        company_id: company.id,
        default_vat_rate: data.is_vat_payer ? 23.00 : 0,
      })

    if (settingsError) {
      console.error("Settings error:", settingsError.message)
    }

    // 4. Create first fiscal year
    const currentYear = new Date().getFullYear()
    const { error: fyError } = await admin
      .from("fiscal_years")
      .insert({
        company_id: company.id,
        name: `Rok ${currentYear}`,
        start_date: `${currentYear}-01-01`,
        end_date: `${currentYear}-12-31`,
        status: "otvoreny",
      })

    if (fyError) {
      console.error("Fiscal year error:", fyError.message)
    }

    // 5. Create default number sequences
    const sequences = [
      { type: "faktura_vydana", prefix: "FA" },
      { type: "faktura_prijata", prefix: "PFA" },
      { type: "zalohova_faktura", prefix: "ZFA" },
      { type: "dobropis", prefix: "DOB" },
      { type: "proforma", prefix: "PRO" },
      { type: "cenova_ponuka", prefix: "CP" },
      { type: "objednavka", prefix: "OBJ" },
      { type: "ppd", prefix: "PPD" },
      { type: "vpd", prefix: "VPD" },
      { type: "interny_doklad", prefix: "ID" },
      { type: "dodaci_list", prefix: "DL" },
    ]

    const { error: seqError } = await admin
      .from("number_sequences")
      .insert(
        sequences.map((s) => ({
          company_id: company.id,
          type: s.type,
          prefix: s.prefix,
          current_number: 0,
          format: "{prefix}{year}{number:06}",
        }))
      )

    if (seqError) {
      console.error("Sequences error:", seqError.message)
    }

    return NextResponse.json(
      { id: company.id, name: company.name },
      { status: 201 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Nastala chyba pri vytváraní firmy" },
      { status: 500 }
    )
  }
}

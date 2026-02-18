import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { companySettingsSchema } from "@/lib/validations/settings"

// GET /api/settings/company - Get company settings
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinne" }, { status: 400 })
  }

  // Verify user has access to this company
  const { data: role, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .single() as { data: any; error: any }

  if (roleError || !role) {
    return NextResponse.json({ error: "Pristup zamietnuty" }, { status: 403 })
  }

  const { data, error } = await (db
    .from("companies") as any)
    .select("*")
    .eq("id", companyId)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// PUT /api/settings/company - Update company settings
export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...settingsData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinne" }, { status: 400 })
  }

  // Verify user is admin
  const { data: role, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", company_id)
    .single() as { data: any; error: any }

  if (roleError || !role || role.role !== "admin") {
    return NextResponse.json({ error: "Pristup zamietnuty - vyzaduje sa rola admin" }, { status: 403 })
  }

  const parsed = companySettingsSchema.safeParse(settingsData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updateData = {
    name: parsed.data.name,
    ico: parsed.data.ico || null,
    dic: parsed.data.dic || null,
    ic_dph: parsed.data.ic_dph || null,
    street: parsed.data.address.street || null,
    city: parsed.data.address.city || null,
    zip: parsed.data.address.zip || null,
    country: parsed.data.address.country,
    business_type: parsed.data.business_type,
    accounting_type: parsed.data.accounting_type,
    is_vat_payer: parsed.data.is_vat_payer,
    vat_period: parsed.data.vat_period || null,
    iban: parsed.data.bank_account_iban || null,
    bic: parsed.data.bank_bic || null,
    logo_url: parsed.data.logo_url || null,
    stamp_url: parsed.data.stamp_url || null,
    signature_url: parsed.data.signature_url || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    web: parsed.data.web || null,
  }

  const { data, error } = await (db
    .from("companies") as any)
    .update(updateData)
    .eq("id", company_id)
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST /api/settings/company - Upload company logo, stamp, or signature
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const companyId = formData.get("company_id") as string | null
  const uploadType = (formData.get("type") as string | null) || "logo"

  if (!file || !companyId) {
    return NextResponse.json({ error: "Subor a company_id su povinne" }, { status: 400 })
  }

  const validTypes = ["logo", "stamp", "signature"]
  if (!validTypes.includes(uploadType)) {
    return NextResponse.json({ error: "Neplatny typ nahravania. Povolene: logo, stamp, signature" }, { status: 400 })
  }

  // Verify user is admin
  const { data: role, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .single() as { data: any; error: any }

  if (roleError || !role || role.role !== "admin") {
    return NextResponse.json({ error: "Pristup zamietnuty" }, { status: 403 })
  }

  const fileExt = file.name.split(".").pop()
  const fileName = `${companyId}/${uploadType}.${fileExt}`

  const { data: uploadData, error: uploadError } = await db.storage
    .from("company-logos")
    .upload(fileName, file, { upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = db.storage
    .from("company-logos")
    .getPublicUrl(fileName)

  const fileUrl = urlData.publicUrl

  // Map upload type to the correct database column
  const columnMap: Record<string, string> = {
    logo: "logo_url",
    stamp: "stamp_url",
    signature: "signature_url",
  }
  const columnName = columnMap[uploadType]

  // Update company record
  const { error: updateError } = await (db
    .from("companies") as any)
    .update({ [columnName]: fileUrl })
    .eq("id", companyId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ [columnName]: fileUrl })
}

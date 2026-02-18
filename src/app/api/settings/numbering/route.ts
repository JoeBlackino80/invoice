import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { numberingSchema } from "@/lib/validations/settings"

// GET /api/settings/numbering - List numbering series for company
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

  // Verify user has access
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
    .from("document_numbering") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("document_type")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

// PUT /api/settings/numbering - Update numbering settings
export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { id, company_id, ...numberingData } = body

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

  if (roleError || !role || !["admin", "uctovnik"].includes(role.role)) {
    return NextResponse.json({ error: "Pristup zamietnuty" }, { status: 403 })
  }

  const parsed = numberingSchema.safeParse(numberingData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updateData = {
    prefix: parsed.data.prefix,
    suffix: parsed.data.suffix || null,
    next_number: parsed.data.next_number,
    padding: parsed.data.padding,
    separator: parsed.data.separator,
    document_type: parsed.data.document_type,
  }

  if (id) {
    // Update existing
    const { data, error } = await (db
      .from("document_numbering") as any)
      .update(updateData)
      .eq("id", id)
      .eq("company_id", company_id)
      .select()
      .single() as { data: any; error: any }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } else {
    // Create new
    const { data, error } = await (db
      .from("document_numbering") as any)
      .insert({ ...updateData, company_id })
      .select()
      .single() as { data: any; error: any }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  }
}

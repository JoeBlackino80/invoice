import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { emailTemplateSchema } from "@/lib/validations/notification"

// GET /api/notifications/email-templates - zoznam emailových šablón
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const { data: templates, error } = await (db
    .from("email_templates") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("type")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: templates || [] })
}

// POST /api/notifications/email-templates - vytvorenie/aktualizácia šablóny
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, id, ...templateData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const parsed = emailTemplateSchema.safeParse(templateData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (id) {
    // Aktualizácia existujúcej šablóny
    const { data: template, error } = await (db
      .from("email_templates") as any)
      .update({
        name: parsed.data.name,
        subject: parsed.data.subject,
        body_html: parsed.data.body_html,
        type: parsed.data.type,
        updated_by: user.id,
      })
      .eq("id", id)
      .eq("company_id", company_id)
      .select()
      .single() as { data: any; error: any }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(template)
  }

  // Vytvorenie novej šablóny
  const { data: template, error } = await (db
    .from("email_templates") as any)
    .insert({
      company_id,
      name: parsed.data.name,
      subject: parsed.data.subject,
      body_html: parsed.data.body_html,
      type: parsed.data.type,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(template, { status: 201 })
}

// DELETE /api/notifications/email-templates - vymazanie vlastnej šablóny
export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const companyId = searchParams.get("company_id")

  if (!id || !companyId) {
    return NextResponse.json({ error: "id a company_id sú povinné" }, { status: 400 })
  }

  const { error } = await (db.from("email_templates") as any)
    .delete()
    .eq("id", id)
    .eq("company_id", companyId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: "Šablóna vymazaná, použije sa predvolená" })
}

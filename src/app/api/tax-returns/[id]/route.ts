import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/tax-returns/:id - detail danoveho priznania
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

  // Fetch tax return
  const { data: taxReturn, error: taxReturnError } = await (db
    .from("tax_returns") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (taxReturnError || !taxReturn) {
    return NextResponse.json({ error: "Danove priznanie nenajdene" }, { status: 404 })
  }

  // Fetch tax return lines
  const { data: lines, error: linesError } = await (db
    .from("tax_return_lines") as any)
    .select("*")
    .eq("tax_return_id", params.id)
    .order("line_number", { ascending: true })

  if (linesError) {
    return NextResponse.json({ error: linesError.message }, { status: 500 })
  }

  return NextResponse.json({
    ...taxReturn,
    lines: lines || [],
  })
}

// PUT /api/tax-returns/:id - uprava danoveho priznania (len draft)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Check if tax return exists and is in draft status
  const { data: existing, error: fetchError } = await (db
    .from("tax_returns") as any)
    .select("id, status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Danove priznanie nenajdene" }, { status: 404 })
  }

  if (existing.status !== "draft") {
    return NextResponse.json({
      error: "Mozno upravovat iba danove priznania v stave 'draft'"
    }, { status: 400 })
  }

  const body = await request.json()
  const { data, xml_content, recognition_type, status } = body

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (data !== undefined) {
    updateData.data = data
  }

  if (xml_content !== undefined) {
    updateData.xml_content = xml_content
  }

  if (recognition_type !== undefined) {
    updateData.recognition_type = recognition_type
  }

  if (status !== undefined && (status === "draft" || status === "final")) {
    updateData.status = status
  }

  const { data: updated, error: updateError } = await (db
    .from("tax_returns") as any)
    .update(updateData)
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}

// DELETE /api/tax-returns/:id - soft delete (len draft)
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

  // Check if tax return exists and is in draft status
  const { data: existing, error: fetchError } = await (db
    .from("tax_returns") as any)
    .select("id, status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Danove priznanie nenajdene" }, { status: 404 })
  }

  if (existing.status !== "draft") {
    return NextResponse.json({
      error: "Mozno odstranit iba danove priznania v stave 'draft'"
    }, { status: 400 })
  }

  const { error } = await (db
    .from("tax_returns") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

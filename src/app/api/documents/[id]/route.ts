import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/documents/:id - get document details with OCR results
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

  const { data, error } = await (db
    .from("documents") as any)
    .select(`
      *,
      document_ocr_results (*)
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: "Dokument nenajdeny" }, { status: 404 })
  }

  return NextResponse.json(data)
}

// DELETE /api/documents/:id - soft delete document and remove from storage
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

  // Fetch document to get storage path
  const { data: document, error: fetchError } = await (db
    .from("documents") as any)
    .select("storage_path")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !document) {
    return NextResponse.json({ error: "Dokument nenajdeny" }, { status: 404 })
  }

  // Soft delete the document record
  const { error: deleteError } = await (db
    .from("documents") as any)
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", params.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Delete from Supabase Storage
  await db.storage.from("documents").remove([document.storage_path])

  return NextResponse.json({ success: true })
}

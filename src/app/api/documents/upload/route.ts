import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isSupportedFile, MAX_FILE_SIZE, SUPPORTED_TYPES } from "@/lib/ocr/pdf-to-image"

// POST /api/documents/upload - upload document
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

  if (!file) {
    return NextResponse.json({ error: "Subor je povinny" }, { status: 400 })
  }

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  // Validate file type
  if (!isSupportedFile(file.type)) {
    return NextResponse.json(
      { error: `Nepodporovany typ suboru. Podporovane: ${SUPPORTED_TYPES.join(", ")}` },
      { status: 400 }
    )
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Subor je prilis velky. Maximalna velkost je 10MB" },
      { status: 400 }
    )
  }

  // Read file buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Generate unique storage path
  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `${companyId}/${timestamp}_${sanitizedName}`

  // Upload to Supabase Storage
  const { error: uploadError } = await db.storage
    .from("documents")
    .upload(storagePath, buffer, {
      contentType: file.type,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Create record in documents table
  const { data: document, error: dbError } = await (db
    .from("documents") as any)
    .insert({
      company_id: companyId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      status: "uploaded",
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (dbError) {
    // Rollback: delete from storage
    await db.storage.from("documents").remove([storagePath])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(
    {
      id: document.id,
      storage_path: document.storage_path,
      file_name: document.file_name,
      file_type: document.file_type,
      file_size: document.file_size,
      status: document.status,
    },
    { status: 201 }
  )
}

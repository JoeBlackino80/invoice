import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { processDocumentWithClaude, processDocumentPDFWithClaude } from "@/lib/ocr/claude-vision"
import { isImageFile, isPDFFile } from "@/lib/ocr/pdf-to-image"

// POST /api/documents/:id/ocr - trigger OCR processing
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Fetch document record
  const { data: document, error: docError } = await (db
    .from("documents") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (docError || !document) {
    return NextResponse.json({ error: "Dokument nenajdeny" }, { status: 404 })
  }

  // Update status to processing
  await (db.from("documents") as any)
    .update({ status: "processing", updated_by: user.id })
    .eq("id", params.id)

  try {
    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await db.storage
      .from("documents")
      .download(document.storage_path)

    if (downloadError || !fileData) {
      await (db.from("documents") as any)
        .update({ status: "error", updated_by: user.id })
        .eq("id", params.id)
      return NextResponse.json({ error: "Nepodarilo sa stiahnut subor" }, { status: 500 })
    }

    // Convert Blob to Buffer and then to base64
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    const mimeType = document.file_type as string

    // Process with Claude based on file type
    let ocrResult
    if (isImageFile(mimeType)) {
      ocrResult = await processDocumentWithClaude(base64, mimeType)
    } else if (isPDFFile(mimeType)) {
      ocrResult = await processDocumentPDFWithClaude(base64)
    } else {
      await (db.from("documents") as any)
        .update({ status: "error", updated_by: user.id })
        .eq("id", params.id)
      return NextResponse.json({ error: "Nepodporovany typ suboru pre OCR" }, { status: 400 })
    }

    // Save OCR results to document_ocr_results table
    const { data: ocrRecord, error: ocrError } = await (db
      .from("document_ocr_results") as any)
      .insert({
        document_id: params.id,
        engine: "claude",
        extracted_data: ocrResult,
        confidence_scores: ocrResult.confidence,
        raw_text: ocrResult.raw_text,
        created_by: user.id,
      })
      .select()
      .single() as { data: any; error: any }

    if (ocrError) {
      await (db.from("documents") as any)
        .update({ status: "error", updated_by: user.id })
        .eq("id", params.id)
      return NextResponse.json({ error: ocrError.message }, { status: 500 })
    }

    // Update document status to processed
    await (db.from("documents") as any)
      .update({
        status: "processed",
        document_type: ocrResult.document_type,
        updated_by: user.id,
      })
      .eq("id", params.id)

    return NextResponse.json({
      document_id: params.id,
      ocr_result_id: ocrRecord.id,
      extracted_data: ocrResult,
      confidence_scores: ocrResult.confidence,
    })
  } catch (error) {
    // Update document status to error
    await (db.from("documents") as any)
      .update({ status: "error", updated_by: user.id })
      .eq("id", params.id)

    const message = error instanceof Error ? error.message : "OCR spracovanie zlyhalo"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

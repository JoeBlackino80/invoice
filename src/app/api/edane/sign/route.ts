import { NextResponse } from "next/server"
import { apiHandler } from "@/lib/api/handler"
import {
  createSigningRequest,
  createSignatureEnvelope,
  verifySignatureStructure,
  prepareForSigning,
} from "@/lib/security/digital-signature"

// POST /api/edane/sign - prepare document for signing or verify signature
export const POST = apiHandler(async (request, { user, db, log }) => {
  const body = await request.json()
  const { action, submission_id, xml_content, document_type } = body

  if (action === "prepare") {
    // Prepare a signing request for browser-based signing
    if (!submission_id) {
      return NextResponse.json({ error: "submission_id je povinný" }, { status: 400 })
    }

    const { data: submission } = await (db.from("edane_submissions") as any)
      .select("*")
      .eq("id", submission_id)
      .single()

    if (!submission) {
      return NextResponse.json({ error: "Podanie nenájdené" }, { status: 404 })
    }

    const envelope = prepareForSigning(submission.xml_content, submission.type)
    const signingRequest = createSigningRequest(
      envelope,
      submission.type
    )

    log.info("Signing request prepared", { submissionId: submission_id })

    return NextResponse.json({
      success: true,
      envelope,
      signingRequest,
    })
  }

  if (action === "attach") {
    // Attach a signed XML back to the submission
    if (!submission_id || !xml_content) {
      return NextResponse.json({
        error: "submission_id a xml_content (podpísaný XML) sú povinné",
      }, { status: 400 })
    }

    // Verify the signature structure
    const verification = verifySignatureStructure(xml_content)

    if (!verification.hasSig) {
      return NextResponse.json({
        error: "Podpísaný XML neobsahuje digitálny podpis",
        verification,
      }, { status: 400 })
    }

    if (verification.issues.length > 0) {
      log.warn("Signature has issues", { issues: verification.issues })
    }

    // Update submission with signed XML
    await (db.from("edane_submissions") as any)
      .update({
        xml_content: xml_content,
        status: "validated",
        response_message: `Podpísané: ${verification.signingTime || "neznámy čas"}`,
      })
      .eq("id", submission_id)

    log.info("Signed XML attached to submission", { submissionId: submission_id })

    return NextResponse.json({
      success: true,
      verification,
      message: "Podpísaný dokument bol uložený",
    })
  }

  if (action === "verify") {
    // Verify an XML document's signature
    if (!xml_content) {
      return NextResponse.json({ error: "xml_content je povinný" }, { status: 400 })
    }

    const verification = verifySignatureStructure(xml_content)

    return NextResponse.json({
      success: verification.hasSig && verification.issues.length === 0,
      verification,
    })
  }

  return NextResponse.json({
    error: "Neplatná akcia. Použite: prepare, attach, verify",
  }, { status: 400 })
})

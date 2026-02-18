import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { submitToFS } from "@/lib/edane/edane-service"

// GET /api/settings/e-dane/:id - Submission detail with XML content
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  const { data, error } = (await (db.from("edane_submissions") as any)
    .select("*")
    .eq("id", params.id)
    .single()) as { data: any; error: any }

  if (error || !data) {
    return NextResponse.json(
      { error: "Podanie nebolo najdene" },
      { status: 404 }
    )
  }

  // Verify user has access to this company
  const { data: role, error: roleError } = (await (
    db.from("user_company_roles") as any
  )
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", data.company_id)
    .single()) as { data: any; error: any }

  if (roleError || !role) {
    return NextResponse.json({ error: "Pristup zamietnuty" }, { status: 403 })
  }

  return NextResponse.json(data)
}

// POST /api/settings/e-dane/:id - Submit to FS SR (simulated)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  // Get the submission
  const { data: submission, error: fetchError } = (await (
    db.from("edane_submissions") as any
  )
    .select("*")
    .eq("id", params.id)
    .single()) as { data: any; error: any }

  if (fetchError || !submission) {
    return NextResponse.json(
      { error: "Podanie nebolo najdene" },
      { status: 404 }
    )
  }

  // Verify user has access
  const { data: role, error: roleError } = (await (
    db.from("user_company_roles") as any
  )
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", submission.company_id)
    .single()) as { data: any; error: any }

  if (roleError || !role) {
    return NextResponse.json({ error: "Pristup zamietnuty" }, { status: 403 })
  }

  // Check submission is in valid state for submission
  if (submission.status === "submitted" || submission.status === "accepted") {
    return NextResponse.json(
      { error: "Podanie uz bolo odoslane" },
      { status: 400 }
    )
  }

  // Submit to FS SR (simulated)
  const result = submitToFS({
    id: submission.id,
    company_id: submission.company_id,
    type: submission.type,
    period: submission.period,
    xml_content: submission.xml_content,
    status: submission.status,
    submitted_at: submission.submitted_at,
    response_message: submission.response_message,
    reference_number: submission.reference_number,
    created_at: submission.created_at,
    updated_at: submission.updated_at,
  })

  if (!result.success) {
    // Update status to rejected if validation failed
    await (db.from("edane_submissions") as any)
      .update({
        status: "rejected",
        response_message: result.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)

    return NextResponse.json(
      {
        success: false,
        message: result.message,
      },
      { status: 400 }
    )
  }

  // Update submission record with success
  const { data: updated, error: updateError } = (await (
    db.from("edane_submissions") as any
  )
    .update({
      status: "submitted",
      submitted_at: result.submitted_at,
      reference_number: result.reference_number,
      response_message: result.message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single()) as { data: any; error: any }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: updated,
    reference_number: result.reference_number,
    message: result.message,
  })
}

// DELETE /api/settings/e-dane/:id - Delete draft submission
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  // Get the submission
  const { data: submission, error: fetchError } = (await (
    db.from("edane_submissions") as any
  )
    .select("id, company_id, status")
    .eq("id", params.id)
    .single()) as { data: any; error: any }

  if (fetchError || !submission) {
    return NextResponse.json(
      { error: "Podanie nebolo najdene" },
      { status: 404 }
    )
  }

  // Verify user has access
  const { data: role, error: roleError } = (await (
    db.from("user_company_roles") as any
  )
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", submission.company_id)
    .single()) as { data: any; error: any }

  if (roleError || !role || role.role !== "admin") {
    return NextResponse.json(
      { error: "Pristup zamietnuty - vyzaduje sa rola admin" },
      { status: 403 }
    )
  }

  // Only allow deletion of draft submissions
  if (
    submission.status !== "draft" &&
    submission.status !== "validated"
  ) {
    return NextResponse.json(
      {
        error:
          "Nie je mozne vymazat odoslane alebo spracovane podanie",
      },
      { status: 400 }
    )
  }

  const { error: deleteError } = await (
    db.from("edane_submissions") as any
  )
    .delete()
    .eq("id", params.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: "Podanie bolo vymazane" })
}

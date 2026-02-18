import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  prepareSubmission,
  validateSubmission,
  type SubmissionType,
  SUBMISSION_TYPE_LABELS,
} from "@/lib/edane/edane-service"

const VALID_TYPES: SubmissionType[] = [
  "dph_priznanie",
  "kontrolny_vykaz",
  "suhrnny_vykaz",
  "dppo",
  "dpfo",
  "mesacny_prehlad",
  "rocne_hlasenie",
]

// GET /api/settings/e-dane - List submission history with filters
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const type = searchParams.get("type")
  const year = searchParams.get("year")
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json(
      { error: "company_id je povinne" },
      { status: 400 }
    )
  }

  // Verify user has access to this company
  const { data: role, error: roleError } = (await (
    db.from("user_company_roles") as any
  )
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .single()) as { data: any; error: any }

  if (roleError || !role) {
    return NextResponse.json({ error: "Pristup zamietnuty" }, { status: 403 })
  }

  let query = (db.from("edane_submissions") as any)
    .select(
      `
      id,
      company_id,
      type,
      period,
      status,
      submitted_at,
      response_message,
      reference_number,
      created_at,
      updated_at
    `,
      { count: "exact" }
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) {
    query = query.eq("type", type)
  }

  if (status) {
    query = query.eq("status", status)
  }

  if (year) {
    query = query.like("period", `${year}%`)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/settings/e-dane - Create and validate new submission
export async function POST(request: Request) {
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

  const body = await request.json()
  const { company_id, type, period, xml_content } = body

  if (!company_id) {
    return NextResponse.json(
      { error: "company_id je povinne" },
      { status: 400 }
    )
  }

  if (!type || !VALID_TYPES.includes(type as SubmissionType)) {
    return NextResponse.json(
      {
        error: `Neplatny typ podania. Povolene: ${VALID_TYPES.join(", ")}`,
      },
      { status: 400 }
    )
  }

  if (!period) {
    return NextResponse.json(
      { error: "Obdobie (period) je povinne" },
      { status: 400 }
    )
  }

  if (!xml_content || xml_content.trim().length === 0) {
    return NextResponse.json(
      { error: "XML obsah je povinny" },
      { status: 400 }
    )
  }

  // Verify user has access to this company
  const { data: role, error: roleError } = (await (
    db.from("user_company_roles") as any
  )
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", company_id)
    .single()) as { data: any; error: any }

  if (roleError || !role) {
    return NextResponse.json({ error: "Pristup zamietnuty" }, { status: 403 })
  }

  // Create submission record
  const submission = prepareSubmission(
    company_id,
    type as SubmissionType,
    period,
    xml_content
  )

  // Validate the XML
  const validation = validateSubmission(submission)

  // Update status based on validation
  const finalStatus = validation.valid ? "validated" : "draft"

  // Save to database
  const { data, error } = (await (db.from("edane_submissions") as any)
    .insert({
      id: submission.id,
      company_id: submission.company_id,
      type: submission.type,
      period: submission.period,
      xml_content: submission.xml_content,
      status: finalStatus,
      submitted_at: null,
      response_message: null,
      reference_number: null,
      created_by: user.id,
    })
    .select()
    .single()) as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    validation,
    type_label: SUBMISSION_TYPE_LABELS[type as SubmissionType],
  })
}

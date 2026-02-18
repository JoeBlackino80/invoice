import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  importDailyClosing,
  calculateDailySummary,
  generateMockReceipts,
  type EKasaReceipt,
} from "@/lib/edane/ekasa-service"

// GET /api/settings/ekasa - List eKasa imports (daily summaries)
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
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json(
      { error: "company_id je povinne" },
      { status: 400 }
    )
  }

  // Verify user has access
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

  let query = (db.from("ekasa_imports") as any)
    .select(
      `
      id,
      company_id,
      date,
      total_receipts,
      total_amount,
      total_vat,
      receipts_data,
      created_at
    `,
      { count: "exact" }
    )
    .eq("company_id", companyId)
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (dateFrom) {
    query = query.gte("date", dateFrom)
  }

  if (dateTo) {
    query = query.lte("date", dateTo)
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

// POST /api/settings/ekasa - Import eKasa daily closing data
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
  const { company_id, date, receipts, generate_mock } = body

  if (!company_id) {
    return NextResponse.json(
      { error: "company_id je povinne" },
      { status: 400 }
    )
  }

  if (!date) {
    return NextResponse.json(
      { error: "Datum je povinny" },
      { status: 400 }
    )
  }

  // Verify user has access
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

  // Use mock data if requested (for testing), otherwise use provided receipts
  let receiptData: EKasaReceipt[] = receipts || []

  if (generate_mock) {
    const mockCount = body.mock_count || 10
    receiptData = generateMockReceipts(date, mockCount)
  }

  // Process the import
  const result = importDailyClosing(company_id, date, receiptData)

  if (!result.success) {
    return NextResponse.json(
      { error: result.message },
      { status: 400 }
    )
  }

  // Save to database
  const { data, error } = (await (db.from("ekasa_imports") as any)
    .insert({
      company_id,
      date,
      total_receipts: result.summary.total_receipts,
      total_amount: result.summary.total_amount,
      total_vat: result.summary.total_vat,
      receipts_data: receiptData,
      created_by: user.id,
    })
    .select()
    .single()) as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    result,
  })
}

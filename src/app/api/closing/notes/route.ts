import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateNotes } from "@/lib/closing/notes-generator"
import type { CompanyInfo } from "@/lib/closing/notes-generator"
import { calculateBalanceSheet } from "@/lib/closing/balance-sheet"
import { calculateProfitLoss } from "@/lib/closing/profit-loss"

// GET /api/closing/notes - Get existing notes
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const fiscalYearId = searchParams.get("fiscal_year_id")

  if (!companyId || !fiscalYearId) {
    return NextResponse.json({ error: "company_id a fiscal_year_id su povinne" }, { status: 400 })
  }

  // Try to fetch saved notes from closing_notes table
  const { data: savedNotes, error } = await (db.from("closing_notes") as any)
    .select("*")
    .eq("company_id", companyId)
    .eq("fiscal_year_id", fiscalYearId)
    .single() as { data: any; error: any }

  if (error || !savedNotes) {
    // No saved notes found, return empty
    return NextResponse.json({ data: null, message: "Poznamky este neboli generovane" })
  }

  return NextResponse.json({ data: savedNotes })
}

// POST /api/closing/notes - Generate or save notes
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, fiscal_year_id, action, sections } = body

  if (!company_id || !fiscal_year_id) {
    return NextResponse.json({ error: "company_id a fiscal_year_id su povinne" }, { status: 400 })
  }

  // If action is "save", save provided sections
  if (action === "save" && sections) {
    const { data: existing } = await (db.from("closing_notes") as any)
      .select("id")
      .eq("company_id", company_id)
      .eq("fiscal_year_id", fiscal_year_id)
      .single() as { data: any; error: any }

    if (existing) {
      // Update
      const { error: updateError } = await (db.from("closing_notes") as any)
        .update({
          sections: sections,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    } else {
      // Insert
      const { error: insertError } = await (db.from("closing_notes") as any)
        .insert({
          company_id: company_id,
          fiscal_year_id: fiscal_year_id,
          sections: sections,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (insertError) {
        // Table might not exist - return the notes anyway
        return NextResponse.json({
          data: { sections },
          warning: "Poznamky boli generovane ale nepodarilo sa ich ulozit do databazy",
        })
      }
    }

    return NextResponse.json({ success: true, message: "Poznamky boli ulozene" })
  }

  // Default: generate notes
  try {
    // Get company info
    const { data: company, error: compError } = await (db.from("companies") as any)
      .select("*")
      .eq("id", company_id)
      .single() as { data: any; error: any }

    if (compError || !company) {
      return NextResponse.json({ error: "Spolocnost sa nenasla" }, { status: 404 })
    }

    // Get fiscal year info
    const { data: fy, error: fyError } = await (db.from("fiscal_years") as any)
      .select("id, year, start_date, end_date")
      .eq("id", fiscal_year_id)
      .eq("company_id", company_id)
      .single() as { data: any; error: any }

    if (fyError || !fy) {
      return NextResponse.json({ error: "Uctovne obdobie sa nenaslo" }, { status: 404 })
    }

    // Build company info
    const companyInfo: CompanyInfo = {
      name: company.name || "",
      ico: company.ico || "",
      dic: company.dic || "",
      ic_dph: company.ic_dph || "",
      address: company.address || "",
      legal_form: company.legal_form || "",
      business_type: company.business_type || "",
      accounting_type: company.accounting_type || "",
    }

    // Try to calculate balance sheet and P&L
    let balanceSheet = null
    let profitLoss = null

    try {
      balanceSheet = await calculateBalanceSheet(company_id, fiscal_year_id, db)
    } catch {
      // Balance sheet calculation failed, continue without it
    }

    try {
      profitLoss = await calculateProfitLoss(company_id, fiscal_year_id, db)
    } catch {
      // P&L calculation failed, continue without it
    }

    const notes = generateNotes(
      company_id,
      `${fy.year}`,
      balanceSheet,
      profitLoss,
      companyInfo
    )

    return NextResponse.json({ data: notes })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Nepodarilo sa generovat poznamky" },
      { status: 500 }
    )
  }
}

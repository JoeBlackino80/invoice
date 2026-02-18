import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { closingChecklistItemSchema } from "@/lib/validations/closing"
import { getClosingChecklist, autoVerifyChecklist, getChecklistProgress } from "@/lib/closing/checklist"

// GET /api/closing/checklist - Ziskanie stavu checklistu pre spolocnost/fiskalny rok
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
  const autoVerify = searchParams.get("auto_verify") === "true"
  const fiscalYearStart = searchParams.get("fiscal_year_start")
  const fiscalYearEnd = searchParams.get("fiscal_year_end")

  if (!companyId || !fiscalYearId) {
    return NextResponse.json({ error: "company_id a fiscal_year_id su povinne" }, { status: 400 })
  }

  try {
    let checklist

    if (autoVerify && fiscalYearStart && fiscalYearEnd) {
      checklist = await autoVerifyChecklist(
        companyId,
        fiscalYearId,
        fiscalYearStart,
        fiscalYearEnd, db)

      // Save auto-verified results
      for (const item of checklist) {
        if (item.status === "done") {
          // Upsert the checklist item
          const { data: existing } = await (db.from("closing_checklist") as any)
            .select("id")
            .eq("company_id", companyId)
            .eq("fiscal_year_id", fiscalYearId)
            .eq("item_id", item.id)
            .is("deleted_at", null)
            .limit(1)

          if (existing && existing.length > 0) {
            await (db.from("closing_checklist") as any)
              .update({ status: "done", updated_by: user.id })
              .eq("id", existing[0].id)
          } else {
            await (db.from("closing_checklist") as any)
              .insert({
                company_id: companyId,
                fiscal_year_id: fiscalYearId,
                item_id: item.id,
                status: "done",
                created_by: user.id,
                updated_by: user.id,
              })
          }
        }
      }
    } else {
      checklist = await getClosingChecklist(companyId, fiscalYearId, db)
    }

    const progress = getChecklistProgress(checklist)

    return NextResponse.json({
      data: checklist,
      progress,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Nepodarilo sa nacitat checklist" }, { status: 500 })
  }
}

// POST /api/closing/checklist - Oznacenie polozky checklistu ako done/skipped/na
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()

  const parsed = closingChecklistItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { company_id, fiscal_year_id, item_id, status, note } = parsed.data

  try {
    // Check if item already exists
    const { data: existing } = await (db.from("closing_checklist") as any)
      .select("id")
      .eq("company_id", company_id)
      .eq("fiscal_year_id", fiscal_year_id)
      .eq("item_id", item_id)
      .is("deleted_at", null)
      .limit(1)

    if (existing && existing.length > 0) {
      // Update existing
      const { data: updated, error: updateError } = await (db.from("closing_checklist") as any)
        .update({
          status,
          note: note || null,
          updated_by: user.id,
        })
        .eq("id", existing[0].id)
        .select()
        .single() as { data: any; error: any }

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json(updated)
    } else {
      // Insert new
      const { data: created, error: createError } = await (db.from("closing_checklist") as any)
        .insert({
          company_id,
          fiscal_year_id,
          item_id,
          status,
          note: note || null,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single() as { data: any; error: any }

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }

      return NextResponse.json(created, { status: 201 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Nepodarilo sa ulozit stav checklistu" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  validateImportData,
  importData,
  type ColumnMapping,
  type EntityType,
} from "@/lib/integrations/csv-import"

// POST /api/integrations/import/confirm
// Confirm and execute the import with mapped columns
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  try {
    const body = await request.json()
    const {
      rows,
      mapping,
      entity_type,
      company_id,
    } = body as {
      rows: string[][]
      mapping: ColumnMapping[]
      entity_type: EntityType
      company_id: string
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Ziadne data na import" }, { status: 400 })
    }

    if (!mapping || !Array.isArray(mapping)) {
      return NextResponse.json({ error: "Mapovanie stlpcov je povinne" }, { status: 400 })
    }

    if (!entity_type) {
      return NextResponse.json({ error: "Typ entity je povinny" }, { status: 400 })
    }

    if (!company_id) {
      return NextResponse.json({ error: "ID spolocnosti je povinne" }, { status: 400 })
    }

    // Verify user has access to this company
    const { data: companyAccess } = await (db.from("user_company_roles") as any)
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .single() as { data: any; error: any }

    if (!companyAccess) {
      return NextResponse.json({ error: "Nemate pristup k tejto spolocnosti" }, { status: 403 })
    }

    // Validate data
    const validation = validateImportData(rows, mapping, entity_type)

    if (!validation.valid && validation.errors.length > 20) {
      return NextResponse.json({
        error: "Data obsahuju prilis vela chyb",
        validation,
      }, { status: 400 })
    }

    // Execute import
    const result = await importData(
      rows,
      mapping,
      entity_type,
      company_id, db)

    return NextResponse.json({
      success: result.success,
      failed: result.failed,
      errors: result.errors.slice(0, 50), // Limit error list
      imported_ids: result.importedIds,
      validation_warnings: validation.warnings,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: `Chyba pri importe: ${err.message || "unknown"}` },
      { status: 500 }
    )
  }
}

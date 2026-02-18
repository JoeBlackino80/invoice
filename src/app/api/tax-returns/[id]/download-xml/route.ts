import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/tax-returns/:id/download-xml - stiahnutie XML suboru
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

  // Fetch tax return
  const { data: taxReturn, error } = await (db
    .from("tax_returns") as any)
    .select("id, type, xml_content, period_from, period_to")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error || !taxReturn) {
    return NextResponse.json({ error: "Danove priznanie nenajdene" }, { status: 404 })
  }

  if (!taxReturn.xml_content) {
    return NextResponse.json({ error: "XML nie je k dispozicii" }, { status: 404 })
  }

  // Build filename
  const typeLabels: Record<string, string> = {
    dph: "dph_priznanie",
    kv_dph: "kv_dph",
    sv: "suhrnny_vykaz",
    dppo: "dppo",
    dpfo: "dpfo_typ_b",
    mesacny_prehlad: "mesacny_prehlad",
    rocne_hlasenie: "rocne_hlasenie",
  }
  const typeLabel = typeLabels[taxReturn.type] || taxReturn.type
  const periodFrom = taxReturn.period_from.replace(/-/g, "")
  const periodTo = taxReturn.period_to.replace(/-/g, "")
  const filename = `${typeLabel}_${periodFrom}_${periodTo}.xml`

  return new Response(taxReturn.xml_content, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

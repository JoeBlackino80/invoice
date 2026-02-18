import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/tax-returns/:id/submit - oznacenie ako podane
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

  // Fetch tax return to check status
  const { data: taxReturn, error: fetchError } = await (db
    .from("tax_returns") as any)
    .select("id, status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !taxReturn) {
    return NextResponse.json({ error: "Danove priznanie nenajdene" }, { status: 404 })
  }

  if (taxReturn.status === "submitted") {
    return NextResponse.json(
      { error: "Danove priznanie uz bolo podane" },
      { status: 400 }
    )
  }

  // Update status to submitted
  const { data: updated, error: updateError } = await (db
    .from("tax_returns") as any)
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}

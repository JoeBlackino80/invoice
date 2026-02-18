import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/travel-orders/:id/approve – schvalenie cestovneho prikazu
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

  // Overit existenciu a aktualny stav
  const { data: order, error: fetchError } = await (
    db.from("travel_orders") as any
  )
    .select("id, status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !order) {
    return NextResponse.json(
      { error: "Cestovny prikaz nebol najdeny" },
      { status: 404 }
    )
  }

  if (order.status !== "draft") {
    return NextResponse.json(
      { error: "Schvalit mozno iba cestovny prikaz v stave 'draft'" },
      { status: 400 }
    )
  }

  const { data, error } = await (db.from("travel_orders") as any)
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

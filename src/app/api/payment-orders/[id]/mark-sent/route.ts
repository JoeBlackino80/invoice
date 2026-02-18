import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/payment-orders/:id/mark-sent - oznacenie ako odoslane do banky
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

  // Fetch the order to check status
  const { data: order, error: fetchError } = await (db
    .from("payment_orders") as any)
    .select("id, status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !order) {
    return NextResponse.json({ error: "Platobny prikaz nebol najdeny" }, { status: 404 })
  }

  if (order.status !== "schvaleny") {
    return NextResponse.json(
      { error: "Oznacit ako odoslany je mozne iba schvalene prikazy. Aktualny stav: " + order.status },
      { status: 400 }
    )
  }

  // Mark as sent
  const { data: updated, error: updateError } = await (db
    .from("payment_orders") as any)
    .update({
      status: "odoslany",
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

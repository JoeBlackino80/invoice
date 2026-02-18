import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/payment-orders/:id/approve - schvalenie platobneho prikazu
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

  if (order.status !== "nova") {
    return NextResponse.json(
      { error: "Schvalit je mozne iba prikazy v stave 'Nova'. Aktualny stav: " + order.status },
      { status: 400 }
    )
  }

  // Approve
  const { data: updated, error: updateError } = await (db
    .from("payment_orders") as any)
    .update({
      status: "schvaleny",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
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

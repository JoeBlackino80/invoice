import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/payment-orders/:id/download - stiahnutie SEPA XML suboru
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

  // Fetch the order
  const { data: order, error } = await (db
    .from("payment_orders") as any)
    .select("id, sepa_xml, status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error || !order) {
    return NextResponse.json({ error: "Platobny prikaz nebol najdeny" }, { status: 404 })
  }

  if (!order.sepa_xml) {
    return NextResponse.json({ error: "SEPA XML nie je k dispozicii" }, { status: 404 })
  }

  // Create short ID for filename
  const shortId = params.id.substring(0, 8)
  const filename = `platobny_prikaz_${shortId}.xml`

  return new Response(order.sepa_xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

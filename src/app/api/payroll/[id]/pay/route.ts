import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/payroll/:id/pay - označenie výplatnej listiny ako vyplatenej
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Fetch payroll run
  const { data: payrollRun, error: runError } = await (db.from("payroll_runs") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (runError) {
    return NextResponse.json({ error: "Výplatná listina nenájdená" }, { status: 404 })
  }

  if (payrollRun.status !== "approved") {
    return NextResponse.json(
      { error: "Vyplatiť je možné iba schválenú výplatnú listinu" },
      { status: 400 }
    )
  }

  // Update status to paid with payment date
  const { data: updated, error: updateError } = await (db.from("payroll_runs") as any)
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}

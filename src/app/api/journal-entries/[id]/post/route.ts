import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkPeriodLock } from "@/lib/accounting/period-lock-check"

// POST /api/journal-entries/:id/post - zauctovanie zapisu (draft -> posted)
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

  // Get the journal entry with lines
  const { data: entry, error: fetchError } = await (db
    .from("journal_entries") as any)
    .select(`
      *,
      lines:journal_entry_lines(
        id,
        side,
        amount
      )
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError) {
    return NextResponse.json({ error: "Uctovny zapis nebol najdeny" }, { status: 404 })
  }

  if (entry.status !== "draft") {
    return NextResponse.json({
      error: "Mozno zauctovat iba zapisy v stave 'draft'. Aktualny stav: " + entry.status
    }, { status: 400 })
  }

  // Check period lock
  const lockResponse = await checkPeriodLock(db, entry.company_id, entry.date)
  if (lockResponse) return lockResponse

  // Validate MD sum = D sum before posting
  const lines = entry.lines || []
  const mdSum = lines
    .filter((l: any) => l.side === "MD")
    .reduce((sum: number, l: any) => sum + Number(l.amount), 0)
  const dSum = lines
    .filter((l: any) => l.side === "D")
    .reduce((sum: number, l: any) => sum + Number(l.amount), 0)

  if (Math.abs(mdSum - dSum) > 0.005) {
    return NextResponse.json({
      error: "Uctovny zapis nie je vyrovnany. Suma MD (" + mdSum.toFixed(2) + ") sa nerovna sume D (" + dSum.toFixed(2) + "). Zauctovanie nie je mozne."
    }, { status: 400 })
  }

  if (lines.length === 0) {
    return NextResponse.json({
      error: "Uctovny zapis nema ziadne riadky. Zauctovanie nie je mozne."
    }, { status: 400 })
  }

  // Post the entry
  const { data: posted, error: postError } = await (db
    .from("journal_entries") as any)
    .update({
      status: "posted",
      posted_at: new Date().toISOString(),
      posted_by: user.id,
      updated_by: user.id,
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (postError) {
    return NextResponse.json({ error: postError.message }, { status: 500 })
  }

  return NextResponse.json(posted)
}

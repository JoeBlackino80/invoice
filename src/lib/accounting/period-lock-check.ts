// Kontrola zamknutého účtovného obdobia
// Používa sa vo všetkých write API routes pre účtovníctvo a faktúry

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Skontroluje či je obdobie obsahujúce daný dátum zamknuté
 */
export async function isPeriodLocked(
  db: SupabaseClient,
  companyId: string,
  date: string
): Promise<boolean> {
  const { data } = await (db.from("period_locks") as any)
    .select("id")
    .eq("company_id", companyId)
    .eq("locked", true)
    .lte("period_start", date)
    .gte("period_end", date)
    .is("deleted_at", null)
    .limit(1)

  return !!(data && data.length > 0)
}

/**
 * Vráti 403 response pre zamknuté obdobie
 */
export function periodLockedResponse(date: string): NextResponse {
  return NextResponse.json(
    {
      error: `Účtovné obdobie obsahujúce dátum ${date} je zamknuté. Nie je možné vykonať zmeny.`,
      code: "PERIOD_LOCKED",
    },
    { status: 403 }
  )
}

/**
 * Helper: skontroluj a vráti response ak je zamknuté, alebo null ak nie
 */
export async function checkPeriodLock(
  db: SupabaseClient,
  companyId: string,
  date: string
): Promise<NextResponse | null> {
  const locked = await isPeriodLocked(db, companyId, date)
  if (locked) {
    return periodLockedResponse(date)
  }
  return null
}

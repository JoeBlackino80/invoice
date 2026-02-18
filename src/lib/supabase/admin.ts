import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Admin client that bypasses RLS using service role key
// Only use in server-side API routes for operations that need elevated privileges
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Helper: verify auth and return admin client for DB operations
// Pattern: auth check via session cookies, DB ops via service role (bypasses RLS)
export async function getAuthenticatedClient() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, db: null as any, error: NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 }) }
  }

  const db = createAdminClient()
  return { user, db, error: null }
}

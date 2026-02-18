import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { portalTokenVerifySchema } from "@/lib/validations/portal"

// POST /api/portal/auth/verify - Overenie prístupového tokenu
export async function POST(request: Request) {
  const supabase = createClient()

  const body = await request.json()
  const parsed = portalTokenVerifySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { email, token } = parsed.data

  // Vyhľadať platný token
  const { data: tokenRecord, error: tokenError } = await (supabase
    .from("portal_tokens") as any)
    .select("id, contact_id, company_id, expires_at")
    .eq("email", email)
    .eq("token", token)
    .single() as { data: any; error: any }

  if (tokenError || !tokenRecord) {
    return NextResponse.json({ error: "Neplatný prístupový kód" }, { status: 401 })
  }

  // Overiť platnosť tokenu
  if (new Date(tokenRecord.expires_at) < new Date()) {
    // Vymazať expirovaný token
    await (supabase
      .from("portal_tokens") as any)
      .delete()
      .eq("id", tokenRecord.id)

    return NextResponse.json({ error: "Prístupový kód vypršal. Vyžiadajte nový." }, { status: 401 })
  }

  // Získať informácie o kontakte
  const { data: contact, error: contactError } = await (supabase
    .from("contacts") as any)
    .select("id, name, email, ico, ic_dph, street, city, zip, phone")
    .eq("id", tokenRecord.contact_id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (contactError || !contact) {
    return NextResponse.json({ error: "Kontakt nenájdený" }, { status: 404 })
  }

  // Získať informácie o firme
  const { data: company, error: companyError } = await (supabase
    .from("companies") as any)
    .select("id, name, logo_url")
    .eq("id", tokenRecord.company_id)
    .single() as { data: any; error: any }

  // Vytvoriť session token pre portál (jednorazový dlhodobejší token)
  const sessionToken = crypto.randomUUID()
  const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hodín

  // Aktualizovať token na session token
  await (supabase
    .from("portal_tokens") as any)
    .update({
      token: sessionToken,
      expires_at: sessionExpiresAt,
    })
    .eq("id", tokenRecord.id)

  return NextResponse.json({
    success: true,
    session_token: sessionToken,
    contact: {
      id: contact.id,
      name: contact.name,
      email: contact.email,
    },
    company: company ? {
      id: company.id,
      name: company.name,
      logo_url: company.logo_url,
    } : null,
  })
}

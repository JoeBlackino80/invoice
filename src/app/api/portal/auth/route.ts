import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { portalEmailSchema } from "@/lib/validations/portal"
import { sendEmail } from "@/lib/email/send"
import { portalTokenTemplate } from "@/lib/email/templates"

// POST /api/portal/auth - Vygenerovať prístupový token pre kontakt
export async function POST(request: Request) {
  const supabase = createClient()

  const body = await request.json()
  const parsed = portalEmailSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { email, company_id } = parsed.data

  // Vyhľadať kontakt podľa emailu
  const { data: contact, error: contactError } = await (supabase
    .from("contacts") as any)
    .select("id, name, email")
    .eq("company_id", company_id)
    .eq("email", email)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (contactError || !contact) {
    // Bezpečnostné: nevyzrádzame, či kontakt existuje
    return NextResponse.json({
      success: true,
      message: "Ak je email registrovaný, prístupový kód bol odoslaný.",
    })
  }

  // Vygenerovať 6-miestny token
  const token = Math.random().toString().substring(2, 8).padStart(6, "0")
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minút

  // Zrušiť staré tokeny pre tento kontakt
  await (supabase
    .from("portal_tokens") as any)
    .delete()
    .eq("contact_id", contact.id)
    .eq("company_id", company_id)

  // Uložiť nový token
  const { error: tokenError } = await (supabase
    .from("portal_tokens") as any)
    .insert({
      contact_id: contact.id,
      company_id,
      email,
      token,
      expires_at: expiresAt,
    })

  if (tokenError) {
    return NextResponse.json({ error: "Nepodarilo sa vytvoriť prístupový kód" }, { status: 500 })
  }

  // Načítať názov spoločnosti pre email šablónu
  const { data: company } = await (supabase
    .from("companies") as any)
    .select("name")
    .eq("id", company_id)
    .single() as { data: any; error: any }

  const companyName = company?.name || "Portál"

  // Odoslať email s prístupovým kódom
  const html = portalTokenTemplate(token, companyName)
  await sendEmail({
    to: email,
    subject: `Prístupový kód - ${companyName}`,
    html,
  })

  return NextResponse.json({
    success: true,
    message: "Ak je email registrovaný, prístupový kód bol odoslaný.",
  })
}

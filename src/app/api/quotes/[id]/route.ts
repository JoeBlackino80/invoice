import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { quoteSchema } from "@/lib/validations/quote"

// GET /api/quotes/:id
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { data, error } = await db
    .from("quotes")
    .select(`
      *,
      contact:contacts (
        id,
        name,
        ico,
        ic_dph,
        street,
        city,
        zip
      )
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

// PUT /api/quotes/:id
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Check if quote exists and is in draft status
  const { data: existingQuote, error: fetchError } = await db
    .from("quotes")
    .select("status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError) {
    return NextResponse.json({ error: "Cenová ponuka nenájdená" }, { status: 404 })
  }

  if (existingQuote.status === "converted") {
    return NextResponse.json({
      error: "Nemožno upravovať konvertovanú ponuku"
    }, { status: 400 })
  }

  const body = await request.json()
  const parsed = quoteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { items, ...quoteHeaderData } = parsed.data

  // Calculate total
  const total = items.reduce((sum, item) => {
    const subtotal = (item.quantity || 1) * item.unit_price
    const vat = subtotal * ((item.vat_rate || 23) / 100)
    return sum + subtotal + vat
  }, 0)

  // Update quote
  const { data: updatedQuote, error: updateError } = await (db
    .from("quotes") as any)
    .update({
      ...quoteHeaderData,
      contact_id: parsed.data.contact_id || null,
      notes: parsed.data.notes || null,
      items,
      total: Math.round(total * 100) / 100,
      updated_by: user.id,
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(updatedQuote)
}

// DELETE /api/quotes/:id (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { data: existingQuote, error: fetchError } = await db
    .from("quotes")
    .select("status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError) {
    return NextResponse.json({ error: "Cenová ponuka nenájdená" }, { status: 404 })
  }

  if (existingQuote.status === "converted") {
    return NextResponse.json({
      error: "Nemožno odstrániť konvertovanú ponuku"
    }, { status: 400 })
  }

  const { error } = await (db
    .from("quotes") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

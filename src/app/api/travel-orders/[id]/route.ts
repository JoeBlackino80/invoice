import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { travelOrderSchema } from "@/lib/validations/travel-order"

// GET /api/travel-orders/:id
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  const { data, error } = await (db.from("travel_orders") as any)
    .select(
      `
      *,
      travel_expenses (*),
      travel_settlements (*),
      employee:employees (
        id,
        name,
        surname,
        address_city,
        iban
      )
    `
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json(
      { error: "Cestovny prikaz nebol najdeny" },
      { status: 404 }
    )
  }

  return NextResponse.json(data)
}

// PUT /api/travel-orders/:id
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  // Overit existenciu a stav
  const { data: existing, error: fetchError } = await (
    db.from("travel_orders") as any
  )
    .select("status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError) {
    return NextResponse.json(
      { error: "Cestovny prikaz nebol najdeny" },
      { status: 404 }
    )
  }

  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "Mozno upravovat iba cestovne prikazy v stave 'draft'" },
      { status: 400 }
    )
  }

  const body = await request.json()
  const parsed = travelOrderSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { data, error } = await (db.from("travel_orders") as any)
    .update({
      employee_id: parsed.data.employee_id,
      type: parsed.data.type,
      purpose: parsed.data.purpose,
      destination: parsed.data.destination,
      country: parsed.data.country || null,
      departure_date: parsed.data.departure_date,
      departure_time: parsed.data.departure_time,
      arrival_date: parsed.data.arrival_date,
      arrival_time: parsed.data.arrival_time,
      transport_type: parsed.data.transport_type,
      vehicle_plate: parsed.data.vehicle_plate || null,
      vehicle_consumption: parsed.data.vehicle_consumption ?? null,
      distance_km: parsed.data.distance_km ?? null,
      fuel_price: parsed.data.fuel_price ?? null,
      advance_amount: parsed.data.advance_amount ?? 0,
      advance_currency: parsed.data.advance_currency,
      updated_by: user.id,
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/travel-orders/:id (soft delete - len draft)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  const { data: existing, error: fetchError } = await (
    db.from("travel_orders") as any
  )
    .select("status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError) {
    return NextResponse.json(
      { error: "Cestovny prikaz nebol najdeny" },
      { status: 404 }
    )
  }

  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "Mozno odstranit iba cestovne prikazy v stave 'draft'" },
      { status: 400 }
    )
  }

  const { error } = await (db.from("travel_orders") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

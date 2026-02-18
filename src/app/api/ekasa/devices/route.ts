import { NextResponse } from "next/server"
import { getAuthenticatedClient } from "@/lib/supabase/admin"

/**
 * GET /api/ekasa/devices - List eKasa devices
 */
export async function GET(request: Request) {
  const { user, db, error } = await getAuthenticatedClient()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const { data, error: dbError } = await (db.from("ekasa_devices") as any)
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

/**
 * POST /api/ekasa/devices - Register a new eKasa device
 */
export async function POST(request: Request) {
  const { user, db, error } = await getAuthenticatedClient()
  if (error) return error

  const body = await request.json()

  if (!body.company_id || !body.dic || !body.cash_register_code || !body.location_name) {
    return NextResponse.json(
      { error: "company_id, dic, cash_register_code a location_name sú povinné" },
      { status: 400 }
    )
  }

  const { data, error: dbError } = await (db.from("ekasa_devices") as any)
    .insert({
      company_id: body.company_id,
      dic: body.dic,
      cash_register_code: body.cash_register_code,
      serial_number: body.serial_number || null,
      device_type: body.device_type || "online",
      location_name: body.location_name,
      location_address: body.location_address || null,
      certificate_subject: body.certificate_subject || null,
      certificate_serial: body.certificate_serial || null,
      certificate_valid_until: body.certificate_valid_until || null,
      is_active: true,
      registered_at: new Date().toISOString(),
      created_by: user!.id,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { travelOrderSchema } from "@/lib/validations/travel-order"
import {
  calculateDomesticTravel,
  calculateForeignTravel,
  calculateTripHours,
  DOMESTIC_MEAL_RATES,
  FOREIGN_PER_DIEM_RATES,
} from "@/lib/travel/travel-calculator"

// GET /api/travel-orders – zoznam cestovnych prikazov
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const search = searchParams.get("search")
  const type = searchParams.get("type")
  const status = searchParams.get("status")
  const employeeId = searchParams.get("employee_id")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json(
      { error: "company_id je povinny" },
      { status: 400 }
    )
  }

  let query = (db.from("travel_orders") as any)
    .select(
      `
      id,
      employee_id,
      type,
      purpose,
      destination,
      country,
      departure_date,
      departure_time,
      arrival_date,
      arrival_time,
      transport_type,
      vehicle_plate,
      distance_km,
      advance_amount,
      advance_currency,
      status,
      total_amount,
      created_at,
      employee:employees (
        id,
        name,
        surname
      )
    `,
      { count: "exact" }
    )
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("departure_date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(
      `destination.ilike.%${search}%,purpose.ilike.%${search}%`
    )
  }

  if (type && type !== "vsetky") {
    query = query.eq("type", type)
  }

  if (status && status !== "vsetky") {
    query = query.eq("status", status)
  }

  if (employeeId) {
    query = query.eq("employee_id", employeeId)
  }

  if (dateFrom) {
    query = query.gte("departure_date", dateFrom)
  }

  if (dateTo) {
    query = query.lte("departure_date", dateTo)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/travel-orders – vytvorenie cestovneho prikazu
export async function POST(request: Request) {
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

  const body = await request.json()
  const { company_id, ...orderData } = body

  if (!company_id) {
    return NextResponse.json(
      { error: "company_id je povinny" },
      { status: 400 }
    )
  }

  const parsed = travelOrderSchema.safeParse(orderData)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Auto-calculate estimated costs
  const departure = new Date(
    `${parsed.data.departure_date}T${parsed.data.departure_time}`
  )
  const arrival = new Date(
    `${parsed.data.arrival_date}T${parsed.data.arrival_time}`
  )
  const hours = calculateTripHours(departure, arrival)

  let estimatedTotal = 0

  if (parsed.data.type === "tuzemsky") {
    const calc = calculateDomesticTravel({
      departure,
      arrival,
      free_meals: { breakfast: false, lunch: false, dinner: false },
      vehicle:
        parsed.data.transport_type === "vlastne_auto" &&
        parsed.data.distance_km &&
        parsed.data.vehicle_consumption &&
        parsed.data.fuel_price
          ? {
              distance_km: parsed.data.distance_km,
              consumption_per_100km: parsed.data.vehicle_consumption,
              fuel_price_per_liter: parsed.data.fuel_price,
            }
          : undefined,
      accommodation: 0,
      other_expenses: 0,
    })
    estimatedTotal = calc.total
  } else if (parsed.data.type === "zahranicny" && parsed.data.country) {
    const countryData = FOREIGN_PER_DIEM_RATES[parsed.data.country]
    if (countryData) {
      const calc = calculateForeignTravel({
        departure,
        arrival,
        country: parsed.data.country,
        free_meals: { breakfast: false, lunch: false, dinner: false },
        pocket_money_percent: 40,
        vehicle:
          parsed.data.transport_type === "vlastne_auto" &&
          parsed.data.distance_km &&
          parsed.data.vehicle_consumption &&
          parsed.data.fuel_price
            ? {
                distance_km: parsed.data.distance_km,
                consumption_per_100km: parsed.data.vehicle_consumption,
                fuel_price_per_liter: parsed.data.fuel_price,
              }
            : undefined,
        accommodation: 0,
        other_expenses: 0,
        exchange_rate: 1,
      })
      estimatedTotal = calc.total_eur
    }
  }

  const { data, error } = await (db.from("travel_orders") as any)
    .insert({
      company_id,
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
      status: parsed.data.status || "draft",
      total_amount: estimatedTotal,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

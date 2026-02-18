import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  generateTravelOrderDocument,
  generateSettlementDocument,
  type CompanyInfo,
  type EmployeeInfo,
  type MealAllowanceDay,
  type VehicleCompensation,
} from "@/lib/travel/travel-pdf-generator"

// GET /api/travel-orders/:id/document?type=order|settlement
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

  const { searchParams } = new URL(request.url)
  const docType = searchParams.get("type") || "order"

  if (docType !== "order" && docType !== "settlement") {
    return NextResponse.json(
      { error: "Neplatny typ dokumentu. Povolene: order, settlement" },
      { status: 400 }
    )
  }

  // 1. Nacitanie cestovneho prikazu
  const { data: travelOrder, error: orderError } = await (db
    .from("travel_orders") as any)
    .select("*")
    .eq("id", params.id)
    .single() as { data: any; error: any }

  if (orderError || !travelOrder) {
    return NextResponse.json(
      { error: "Cestovny prikaz nebol najdeny" },
      { status: 404 }
    )
  }

  // 2. Nacitanie spolocnosti
  const { data: company, error: companyError } = await (db
    .from("companies") as any)
    .select("name, ico, dic, street, city, zip")
    .eq("id", travelOrder.company_id)
    .single() as { data: any; error: any }

  if (companyError || !company) {
    return NextResponse.json(
      { error: "Spolocnost nebola najdena" },
      { status: 404 }
    )
  }

  const companyInfo: CompanyInfo = {
    name: company.name,
    ico: company.ico,
    dic: company.dic,
    street: company.street,
    city: company.city,
    zip: company.zip,
  }

  const employeeInfo: EmployeeInfo = {
    name: travelOrder.employee_name || "Neuvedene",
    position: travelOrder.employee_position,
    department: travelOrder.employee_department,
  }

  // 3a. Cestovny prikaz (pred cestou)
  if (docType === "order") {
    const document = generateTravelOrderDocument(
      {
        id: travelOrder.id,
        number: travelOrder.number,
        destination: travelOrder.destination,
        purpose: travelOrder.purpose,
        date_from: travelOrder.date_from,
        date_to: travelOrder.date_to,
        departure_time: travelOrder.departure_time,
        arrival_time: travelOrder.arrival_time,
        transport_type: travelOrder.transport_type || "auto",
        vehicle_registration: travelOrder.vehicle_registration,
        is_foreign: travelOrder.is_foreign || false,
        country: travelOrder.country,
        estimated_meals: travelOrder.estimated_meals || 0,
        estimated_transport: travelOrder.estimated_transport || 0,
        estimated_accommodation: travelOrder.estimated_accommodation || 0,
        estimated_other: travelOrder.estimated_other || 0,
        advance_amount: travelOrder.advance_amount || 0,
        advance_payment_method: travelOrder.advance_payment_method,
        notes: travelOrder.notes,
        approved_by: travelOrder.approved_by,
        approval_date: travelOrder.approval_date,
        created_at: travelOrder.created_at,
      },
      employeeInfo,
      companyInfo
    )

    return NextResponse.json(document)
  }

  // 3b. Vyuctovanie (po ceste)
  const { data: settlement, error: settlementError } = await (db
    .from("travel_settlements") as any)
    .select("*")
    .eq("travel_order_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single() as { data: any; error: any }

  if (settlementError || !settlement) {
    return NextResponse.json(
      { error: "Vyuctovanie este nebolo vytvorene pre tento cestovny prikaz" },
      { status: 404 }
    )
  }

  // Nacitanie detailov o dnovom stravnom
  const { data: mealDays } = await (db
    .from("travel_meal_days") as any)
    .select("*")
    .eq("settlement_id", settlement.id)
    .order("date", { ascending: true })

  const mealDaysData: MealAllowanceDay[] = (mealDays || []).map(
    (day: any) => ({
      date: day.date,
      hours: day.hours || 0,
      base_rate: day.base_rate || 0,
      breakfast_free: day.breakfast_free || false,
      lunch_free: day.lunch_free || false,
      dinner_free: day.dinner_free || false,
      reduction_percent: day.reduction_percent || 0,
      reduction_amount: day.reduction_amount || 0,
      final_amount: day.final_amount || 0,
    })
  )

  // Vozidlo
  let vehicleCompensation: VehicleCompensation | undefined
  if (
    travelOrder.transport_type === "vlastne_auto" ||
    travelOrder.transport_type === "private_vehicle"
  ) {
    vehicleCompensation = {
      km_driven: settlement.km_driven || 0,
      rate_per_km: settlement.rate_per_km || 0.227,
      fuel_consumption: settlement.fuel_consumption || 0,
      fuel_price: settlement.fuel_price || 0,
      fuel_cost: settlement.fuel_cost || 0,
      wear_compensation: settlement.wear_compensation || 0,
      total: settlement.transport_cost || 0,
    }
  }

  // Ubytovanie
  const { data: accReceipts } = await (db
    .from("travel_expenses") as any)
    .select("description, amount")
    .eq("settlement_id", settlement.id)
    .eq("category", "accommodation")

  // Ostatne
  const { data: otherExpenses } = await (db
    .from("travel_expenses") as any)
    .select("description, amount")
    .eq("settlement_id", settlement.id)
    .eq("category", "other")

  const document = generateSettlementDocument(
    {
      id: travelOrder.id,
      number: travelOrder.number,
      destination: travelOrder.destination,
      purpose: travelOrder.purpose,
      date_from: travelOrder.date_from,
      date_to: travelOrder.date_to,
      departure_time: travelOrder.departure_time,
      arrival_time: travelOrder.arrival_time,
      transport_type: travelOrder.transport_type || "auto",
      vehicle_registration: travelOrder.vehicle_registration,
      is_foreign: travelOrder.is_foreign || false,
      country: travelOrder.country,
      advance_amount: travelOrder.advance_amount || 0,
      created_at: travelOrder.created_at,
    },
    {
      id: settlement.id,
      meal_allowance: settlement.meal_allowance || 0,
      transport_cost: settlement.transport_cost || 0,
      accommodation_cost: settlement.accommodation_cost || 0,
      other_costs: settlement.other_costs || 0,
      total_expenses: settlement.total_expenses || 0,
      payment_method: settlement.payment_method || "cash",
      settlement_date:
        settlement.settlement_date ||
        new Date().toISOString().split("T")[0],
      notes: settlement.notes,
    },
    {
      meal_days: mealDaysData,
      vehicle_compensation: vehicleCompensation,
      accommodation_receipts: (accReceipts || []).map((r: any) => ({
        description: r.description || "Ubytovanie",
        amount: r.amount || 0,
      })),
      other_expenses: (otherExpenses || []).map((r: any) => ({
        description: r.description || "Ostatne",
        amount: r.amount || 0,
      })),
    },
    employeeInfo,
    companyInfo
  )

  return NextResponse.json(document)
}

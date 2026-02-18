import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  calculateDomesticTravel,
  calculateForeignTravel,
  calculateTripHours,
  FOREIGN_PER_DIEM_RATES,
} from "@/lib/travel/travel-calculator"

// POST /api/travel-orders/:id/settle – vyuctovanie cestovneho prikazu
export async function POST(
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

  // Nacitat cestovny prikaz so vsetkymi vydavkami
  const { data: order, error: fetchError } = await (
    db.from("travel_orders") as any
  )
    .select(
      `
      *,
      travel_expenses (*)
    `
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !order) {
    return NextResponse.json(
      { error: "Cestovny prikaz nebol najdeny" },
      { status: 404 }
    )
  }

  if (order.status !== "completed" && order.status !== "approved") {
    return NextResponse.json(
      {
        error:
          "Vyuctovat mozno iba cestovny prikaz v stave 'approved' alebo 'completed'",
      },
      { status: 400 }
    )
  }

  // Nacitat body z requestu (volitelne free_meals, pocket_money, exchange_rate)
  let bodyData: any = {}
  try {
    bodyData = await request.json()
  } catch {
    // Request moze byt prazdny
  }

  const freeBreakfast = bodyData.free_breakfast ?? false
  const freeLunch = bodyData.free_lunch ?? false
  const freeDinner = bodyData.free_dinner ?? false
  const pocketMoneyPercent = bodyData.pocket_money_percent ?? 40
  const exchangeRate = bodyData.exchange_rate ?? 1

  // Kalkulacia
  const departure = new Date(
    `${order.departure_date}T${order.departure_time}`
  )
  const arrival = new Date(`${order.arrival_date}T${order.arrival_time}`)

  let calculatedMealAllowance = 0
  let calculatedVehicle = 0
  let calculatedTotal = 0

  const expenses: any[] = order.travel_expenses || []
  const accommodationExpenses = expenses
    .filter((e: any) => e.expense_type === "ubytovanie")
    .reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
  const otherExpenses = expenses
    .filter(
      (e: any) =>
        e.expense_type !== "ubytovanie" && e.expense_type !== "stravne"
    )
    .reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

  const hasVehicle =
    order.transport_type === "vlastne_auto" &&
    order.distance_km &&
    order.vehicle_consumption &&
    order.fuel_price

  if (order.type === "tuzemsky") {
    const calc = calculateDomesticTravel({
      departure,
      arrival,
      free_meals: {
        breakfast: freeBreakfast,
        lunch: freeLunch,
        dinner: freeDinner,
      },
      vehicle: hasVehicle
        ? {
            distance_km: order.distance_km,
            consumption_per_100km: order.vehicle_consumption,
            fuel_price_per_liter: order.fuel_price,
          }
        : undefined,
      accommodation: accommodationExpenses,
      other_expenses: otherExpenses,
    })
    calculatedMealAllowance = calc.net_meal_allowance
    calculatedVehicle = calc.vehicle_compensation?.total ?? 0
    calculatedTotal = calc.total
  } else {
    const calc = calculateForeignTravel({
      departure,
      arrival,
      country: order.country || "",
      free_meals: {
        breakfast: freeBreakfast,
        lunch: freeLunch,
        dinner: freeDinner,
      },
      pocket_money_percent: pocketMoneyPercent,
      vehicle: hasVehicle
        ? {
            distance_km: order.distance_km,
            consumption_per_100km: order.vehicle_consumption,
            fuel_price_per_liter: order.fuel_price,
          }
        : undefined,
      accommodation: accommodationExpenses,
      other_expenses: otherExpenses,
      exchange_rate: exchangeRate,
    })
    calculatedMealAllowance = calc.net_per_diem
    calculatedVehicle = calc.vehicle_compensation?.total ?? 0
    calculatedTotal = calc.total_eur
  }

  const totalExpenses =
    calculatedMealAllowance +
    calculatedVehicle +
    accommodationExpenses +
    otherExpenses

  const advanceAmount = order.advance_amount || 0
  const difference = Math.round((totalExpenses - advanceAmount) * 100) / 100

  // Vytvorit zaznam o vyuctovani
  const { data: settlement, error: settlementError } = await (
    db.from("travel_settlements") as any
  )
    .insert({
      travel_order_id: params.id,
      company_id: order.company_id,
      total_expenses: totalExpenses,
      meal_allowance: calculatedMealAllowance,
      vehicle_compensation: calculatedVehicle,
      accommodation: accommodationExpenses,
      other_expenses: otherExpenses,
      advance_amount: advanceAmount,
      difference,
      settlement_date: new Date().toISOString().split("T")[0],
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (settlementError) {
    return NextResponse.json(
      { error: settlementError.message },
      { status: 500 }
    )
  }

  // Aktualizovat stav cestovneho prikazu na 'settled'
  const { error: updateError } = await (
    db.from("travel_orders") as any
  )
    .update({
      status: "settled",
      total_amount: totalExpenses,
      updated_by: user.id,
    })
    .eq("id", params.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    settlement,
    summary: {
      meal_allowance: calculatedMealAllowance,
      vehicle_compensation: calculatedVehicle,
      accommodation: accommodationExpenses,
      other_expenses: otherExpenses,
      total_expenses: totalExpenses,
      advance_amount: advanceAmount,
      difference,
      difference_label:
        difference > 0
          ? "Doplatit zamestnancovi"
          : difference < 0
            ? "Zamestnanec vracia"
            : "Vyrovnane",
    },
  })
}

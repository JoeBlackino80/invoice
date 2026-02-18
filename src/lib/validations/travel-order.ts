import { z } from "zod"

// ---------- Travel Order Schema ----------

export const travelOrderSchema = z.object({
  employee_id: z.string().min(1, "Zamestnanec je povinny"),
  type: z.enum(["tuzemsky", "zahranicny"], {
    message: "Neplatny typ cestovneho prikazu",
  }),
  purpose: z.string().min(1, "Ucel cesty je povinny"),
  destination: z.string().min(1, "Destinacia je povinna"),
  country: z.string().optional().or(z.literal("")),
  departure_date: z.string().min(1, "Datum odchodu je povinny"),
  departure_time: z.string().min(1, "Cas odchodu je povinny"),
  arrival_date: z.string().min(1, "Datum prichodu je povinny"),
  arrival_time: z.string().min(1, "Cas prichodu je povinny"),
  transport_type: z.enum(
    ["vlastne_auto", "sluzbne_auto", "vlak", "autobus", "lietadlo", "iny"],
    { message: "Neplatny typ dopravy" }
  ),
  vehicle_plate: z.string().optional().or(z.literal("")),
  vehicle_consumption: z.number().min(0).optional(),
  distance_km: z.number().min(0).optional(),
  fuel_price: z.number().min(0).optional(),
  advance_amount: z.number().min(0).optional(),
  advance_currency: z.string().default("EUR"),
  status: z
    .enum(["draft", "approved", "completed", "settled"], {
      message: "Neplatny stav",
    })
    .default("draft"),
})

export type TravelOrderInput = z.input<typeof travelOrderSchema>

// ---------- Travel Expense Schema ----------

export const travelExpenseSchema = z.object({
  travel_order_id: z.string().min(1, "ID cestovneho prikazu je povinne"),
  expense_type: z.enum(
    [
      "stravne",
      "ubytovanie",
      "cestovne",
      "parkovne",
      "dialnicna_znamka",
      "mhd",
      "poistenie",
      "ine",
    ],
    { message: "Neplatny typ vydavku" }
  ),
  amount: z.number().min(0, "Suma musi byt kladna"),
  currency: z.string().default("EUR"),
  description: z.string().optional().or(z.literal("")),
  receipt_url: z.string().optional().or(z.literal("")),
})

export type TravelExpenseInput = z.input<typeof travelExpenseSchema>

// ---------- Travel Settlement Schema ----------

export const travelSettlementSchema = z.object({
  travel_order_id: z.string().min(1, "ID cestovneho prikazu je povinne"),
  total_expenses: z.number().min(0, "Celkove vydavky musia byt kladne"),
  advance_amount: z.number().min(0, "Preddavok musi byt kladny").default(0),
  difference: z.number(), // kladne = vratit, zaporne = doplatit
  settlement_date: z.string().min(1, "Datum vyuctovania je povinny"),
})

export type TravelSettlementInput = z.input<typeof travelSettlementSchema>

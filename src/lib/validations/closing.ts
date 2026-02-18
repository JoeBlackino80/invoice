import { z } from "zod"

export const closingChecklistSchema = z.object({
  fiscal_year_id: z.string().uuid("Neplatne ID fiskalneho roka"),
  company_id: z.string().uuid("Neplatne ID spolocnosti"),
})

export const closingChecklistItemSchema = z.object({
  fiscal_year_id: z.string().uuid("Neplatne ID fiskalneho roka"),
  company_id: z.string().uuid("Neplatne ID spolocnosti"),
  item_id: z.string().min(1, "ID polozky je povinne"),
  status: z.enum(["pending", "done", "skipped", "na"], {
    message: "Neplatny stav polozky",
  }),
  note: z.string().optional(),
})

export const closingOperationSchema = z.object({
  type: z.enum(["revenue_close", "expense_close", "profit_loss_close", "balance_close"], {
    message: "Neplatny typ uzavierkovej operacie",
  }),
  fiscal_year_id: z.string().uuid("Neplatne ID fiskalneho roka"),
  company_id: z.string().uuid("Neplatne ID spolocnosti"),
})

export const periodLockSchema = z.object({
  company_id: z.string().uuid("Neplatne ID spolocnosti"),
  period_start: z.string().min(1, "Zaciatok obdobia je povinny"),
  period_end: z.string().min(1, "Koniec obdobia je povinny"),
  locked: z.boolean(),
})

export const openingBalanceSchema = z.object({
  company_id: z.string().uuid("Neplatne ID spolocnosti"),
  fiscal_year_id: z.string().uuid("Neplatne ID fiskalneho roka"),
  account_id: z.string().uuid("Neplatne ID uctu"),
  debit: z.number().min(0, "Debetna suma nemoze byt zaporna"),
  credit: z.number().min(0, "Kreditna suma nemoze byt zaporna"),
})

export type ClosingChecklistInput = z.input<typeof closingChecklistSchema>
export type ClosingChecklistItemInput = z.input<typeof closingChecklistItemSchema>
export type ClosingOperationInput = z.input<typeof closingOperationSchema>
export type PeriodLockInput = z.input<typeof periodLockSchema>
export type OpeningBalanceInput = z.input<typeof openingBalanceSchema>

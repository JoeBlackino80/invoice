import { z } from "zod"

export const cashRegisterSchema = z.object({
  name: z.string().min(1),
  currency: z.string().default("EUR"),
  initial_balance: z.number().default(0),
  account_number: z.string().default("211"), // synteticky ucet
})

export const cashTransactionSchema = z.object({
  cash_register_id: z.string().uuid(),
  type: z.enum(["prijem", "vydaj"]), // PPD / VPD
  date: z.string(),
  amount: z.number().positive(),
  purpose: z.string().min(1),
  person: z.string().optional(), // osoba
  invoice_id: z.string().uuid().optional(), // link to invoice
  notes: z.string().optional(),
})

export type CashRegisterInput = z.input<typeof cashRegisterSchema>
export type CashTransactionInput = z.input<typeof cashTransactionSchema>

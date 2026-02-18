import { z } from "zod"

export const bankAccountSchema = z.object({
  name: z.string().min(1),
  iban: z.string().min(1),
  bic: z.string().optional(),
  currency: z.string().default("EUR"),
  bank_name: z.string().optional(),
  account_number: z.string().default("221"), // synteticky ucet
  opening_balance: z.number().default(0),
})

export const bankStatementSchema = z.object({
  bank_account_id: z.string().uuid(),
  statement_number: z.string().optional(),
  date: z.string(),
  opening_balance: z.number(),
  closing_balance: z.number(),
})

export type BankAccountInput = z.input<typeof bankAccountSchema>
export type BankStatementInput = z.input<typeof bankStatementSchema>

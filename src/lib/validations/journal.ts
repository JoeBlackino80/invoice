import { z } from "zod"

export const journalEntryLineSchema = z.object({
  account_id: z.string().uuid(),
  side: z.enum(["MD", "D"]), // Ma dat / Dal
  amount: z.number().positive(),
  amount_currency: z.number().optional(),
  currency: z.string().default("EUR"),
  exchange_rate: z.number().optional(),
  cost_center_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  description: z.string().optional(),
})

export const journalEntrySchema = z.object({
  document_type: z.enum(["FA", "PFA", "ID", "BV", "PPD", "VPD"]),
  // FA=faktura, PFA=prijata faktura, ID=interny doklad
  // BV=bankovy vypis, PPD=prijmovy pokl. doklad, VPD=vydavkovy pokl. doklad
  date: z.string(), // accounting date
  description: z.string().min(1),
  source_invoice_id: z.string().uuid().optional(),
  source_document_id: z.string().uuid().optional(),
  lines: z.array(journalEntryLineSchema).min(1),
})

export const predkontaciaSchema = z.object({
  name: z.string().min(1),
  document_type: z.enum(["FA", "PFA", "ID", "BV", "PPD", "VPD"]),
  description: z.string().optional(),
  lines: z.array(z.object({
    account_synteticky: z.string().min(3).max(3),
    account_analyticky: z.string().optional(),
    side: z.enum(["MD", "D"]),
    is_amount_field: z.boolean().default(true), // true = uses document amount
    fixed_amount: z.number().optional(), // for fixed amounts
    percentage: z.number().optional(), // for % of base (e.g. DPH)
    description: z.string().optional(),
  })).min(1),
})

export type JournalEntryInput = z.input<typeof journalEntrySchema>
export type PredkontaciaInput = z.input<typeof predkontaciaSchema>

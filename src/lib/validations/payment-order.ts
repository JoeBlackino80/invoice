import { z } from "zod"

export const paymentOrderItemSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().positive(),
  variable_symbol: z.string().optional(),
  constant_symbol: z.string().optional(),
  specific_symbol: z.string().optional(),
})

export const paymentOrderSchema = z.object({
  bank_account_id: z.string().uuid(),
  requested_date: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(paymentOrderItemSchema).min(1),
})

export type PaymentOrderInput = z.input<typeof paymentOrderSchema>
export type PaymentOrderItemInput = z.input<typeof paymentOrderItemSchema>

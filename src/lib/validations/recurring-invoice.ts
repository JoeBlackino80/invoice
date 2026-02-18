import { z } from "zod";

export const recurringInvoiceSchema = z.object({
  type: z.enum(["vydana", "prijata"]).default("vydana"),
  contact_id: z.string().optional(),
  interval: z.enum(["monthly", "quarterly", "annually"]),
  next_generation_date: z.string(),
  currency: z.string().default("EUR"),
  exchange_rate: z.number().default(1),
  variable_symbol: z.string().optional(),
  reverse_charge: z.boolean().default(false),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().default(1),
    unit: z.string().default("ks"),
    unit_price: z.number(),
    vat_rate: z.number().default(23),
  })).min(1, { message: "Musí mať aspoň jednu položku" }),
});

export type RecurringInvoiceInput = z.input<typeof recurringInvoiceSchema>;

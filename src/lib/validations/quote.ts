import { z } from "zod";

const quoteItemSchema = z.object({
  description: z.string(),
  quantity: z.number().default(1),
  unit: z.string().default("ks"),
  unit_price: z.number(),
  vat_rate: z.number().default(23),
});

export const quoteSchema = z.object({
  contact_id: z.string().optional(),
  issue_date: z.string(),
  valid_until: z.string(),
  currency: z.string().default("EUR"),
  notes: z.string().optional(),
  items: z.array(quoteItemSchema).min(1, { message: "Mus\u00ed ma\u0165 aspo\u0148 jednu polo\u017eku" }),
});

export const orderSchema = z.object({
  contact_id: z.string().optional(),
  issue_date: z.string(),
  currency: z.string().default("EUR"),
  notes: z.string().optional(),
  items: z.array(quoteItemSchema).min(1, { message: "Mus\u00ed ma\u0165 aspo\u0148 jednu polo\u017eku" }),
});

export type QuoteInput = z.input<typeof quoteSchema>;
export type OrderInput = z.input<typeof orderSchema>;

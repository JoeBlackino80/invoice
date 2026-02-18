import { z } from "zod";

export const invoiceItemSchema = z.object({
  description: z.string(),
  quantity: z.number().default(1),
  unit: z.string().default("ks"),
  unit_price: z.number(),
  vat_rate: z.number().default(23),
  product_id: z.string().optional(),
});

export const invoiceSchema = z.object({
  type: z.enum(["vydana", "prijata", "zalohova", "dobropis", "proforma"]).default("vydana"),
  contact_id: z.string().optional(),
  parent_invoice_id: z.string().optional(),
  issue_date: z.string(),
  delivery_date: z.string(),
  due_date: z.string(),
  currency: z.string().default("EUR"),
  exchange_rate: z.number().default(1),
  variable_symbol: z.string().optional(),
  constant_symbol: z.string().optional(),
  specific_symbol: z.string().optional(),
  reverse_charge: z.boolean().default(false),
  reverse_charge_text: z.string().optional(),
  vat_exemption_reason: z.string().optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, { message: "Faktúra musí mať aspoň jednu položku" }),
});

export type InvoiceInput = z.input<typeof invoiceSchema>;
export type InvoiceItemInput = z.input<typeof invoiceItemSchema>;

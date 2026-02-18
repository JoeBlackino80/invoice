import { z } from "zod"

// Produkt schema
export const productSchema = z.object({
  name: z.string().min(1, "Názov je povinný"),
  sku: z.string().min(1, "SKU kód je povinný"),
  description: z.string().optional().or(z.literal("")),
  unit: z.enum(["ks", "kg", "l", "m", "m2", "m3", "t", "bal", "kart"], { message: "Neplatná jednotka" }),
  category_id: z.string().optional().or(z.literal("")),
  min_stock: z.number().optional(),
  max_stock: z.number().optional(),
  ean_code: z.string().optional().or(z.literal("")),
  purchase_price: z.number().optional(),
  sale_price: z.number().optional(),
  vat_rate: z.number().default(23),
})

export type ProductInput = z.input<typeof productSchema>

// Sklad schema
export const warehouseSchema = z.object({
  name: z.string().min(1, "Názov skladu je povinný"),
  code: z.string().min(1, "Kód skladu je povinný"),
  address: z.string().optional().or(z.literal("")),
  is_default: z.boolean().default(false),
})

export type WarehouseInput = z.input<typeof warehouseSchema>

// Príjemka item schema
export const stockReceiptItemSchema = z.object({
  product_id: z.string().min(1, "Produkt je povinný"),
  quantity: z.number().positive("Množstvo musí byť kladné"),
  unit_price: z.number().min(0, "Cena musí byť nezáporná"),
  batch_number: z.string().optional().or(z.literal("")),
  serial_number: z.string().optional().or(z.literal("")),
})

// Príjemka schema
export const stockReceiptSchema = z.object({
  warehouse_id: z.string().min(1, "Sklad je povinný"),
  supplier_id: z.string().optional().or(z.literal("")),
  receipt_number: z.string().min(1, "Číslo príjemky je povinné"),
  receipt_date: z.string().min(1, "Dátum je povinný"),
  note: z.string().optional().or(z.literal("")),
  items: z.array(stockReceiptItemSchema).min(1, { message: "Príjemka musí mať aspoň jednu položku" }),
})

export type StockReceiptInput = z.input<typeof stockReceiptSchema>
export type StockReceiptItemInput = z.input<typeof stockReceiptItemSchema>

// Výdajka item schema
export const stockIssueItemSchema = z.object({
  product_id: z.string().min(1, "Produkt je povinný"),
  quantity: z.number().positive("Množstvo musí byť kladné"),
})

// Výdajka schema
export const stockIssueSchema = z.object({
  warehouse_id: z.string().min(1, "Sklad je povinný"),
  customer_id: z.string().optional().or(z.literal("")),
  issue_number: z.string().min(1, "Číslo výdajky je povinné"),
  issue_date: z.string().min(1, "Dátum je povinný"),
  note: z.string().optional().or(z.literal("")),
  reason: z.enum(["predaj", "spotreba", "likvidacia", "prevod"], { message: "Neplatný dôvod výdaja" }),
  items: z.array(stockIssueItemSchema).min(1, { message: "Výdajka musí mať aspoň jednu položku" }),
})

export type StockIssueInput = z.input<typeof stockIssueSchema>
export type StockIssueItemInput = z.input<typeof stockIssueItemSchema>

// Prevodka item schema
export const stockTransferItemSchema = z.object({
  product_id: z.string().min(1, "Produkt je povinný"),
  quantity: z.number().positive("Množstvo musí byť kladné"),
})

// Prevodka schema
export const stockTransferSchema = z.object({
  from_warehouse_id: z.string().min(1, "Zdrojový sklad je povinný"),
  to_warehouse_id: z.string().min(1, "Cieľový sklad je povinný"),
  transfer_number: z.string().min(1, "Číslo prevodky je povinné"),
  transfer_date: z.string().min(1, "Dátum je povinný"),
  note: z.string().optional().or(z.literal("")),
  items: z.array(stockTransferItemSchema).min(1, { message: "Prevodka musí mať aspoň jednu položku" }),
})

export type StockTransferInput = z.input<typeof stockTransferSchema>
export type StockTransferItemInput = z.input<typeof stockTransferItemSchema>

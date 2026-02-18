import { z } from "zod"

export const assetSchema = z.object({
  name: z.string().min(1, "Nazov majetku je povinny"),
  description: z.string().optional().or(z.literal("")),
  acquisition_date: z.string().min(1, "Datum obstarania je povinny"),
  acquisition_cost: z.number().positive("Obstaravacia cena musi byt kladna"),
  category_id: z.string().uuid().optional().nullable(),
  depreciation_group: z.number().min(0, "Odpisova skupina musi byt 0-6").max(6, "Odpisova skupina musi byt 0-6"),
  depreciation_method: z.enum(["rovnomerne", "zrychlene"], {
    message: "Metoda musi byt rovnomerne alebo zrychlene",
  }),
  useful_life_years: z.number().positive("Doba odpisovania musi byt kladna").optional(),
  tax_residual_value: z.number().min(0).optional().default(0),
  accounting_residual_value: z.number().min(0).optional().default(0),
})

export type AssetInput = z.input<typeof assetSchema>

export const assetCategorySchema = z.object({
  name: z.string().min(1, "Nazov kategorie je povinny"),
  depreciation_group: z.number().min(0).max(6),
  useful_life: z.number().positive().optional(),
  depreciation_method: z.enum(["rovnomerne", "zrychlene"]).default("rovnomerne"),
})

export type AssetCategoryInput = z.input<typeof assetCategorySchema>

export const assetDisposeSchema = z.object({
  disposed_reason: z.enum(["predaj", "likvidacia", "strata", "dar"], {
    message: "Neplatny dovod vyradenia",
  }),
  disposed_date: z.string().min(1, "Datum vyradenia je povinny"),
  sale_amount: z.number().min(0).optional(),
})

export type AssetDisposeInput = z.input<typeof assetDisposeSchema>

export const depreciateSchema = z.object({
  year: z.number().int().min(2000).max(2100),
})

export type DepreciateInput = z.input<typeof depreciateSchema>

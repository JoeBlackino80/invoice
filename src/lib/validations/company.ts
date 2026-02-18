import { z } from "zod"

export const companySchema = z.object({
  name: z.string().min(1, "Názov firmy je povinný"),
  ico: z.string().length(8, "IČO musí mať 8 číslic").regex(/^\d+$/, "IČO musí obsahovať len čísla").optional().or(z.literal("")),
  dic: z.string().optional().or(z.literal("")),
  ic_dph: z.string().optional().or(z.literal("")),
  street: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  zip: z.string().optional().or(z.literal("")),
  country: z.string().default("SK"),
  email: z.string().email("Neplatný email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  web: z.string().optional().or(z.literal("")),
  iban: z.string().optional().or(z.literal("")),
  bic: z.string().optional().or(z.literal("")),
  bank_name: z.string().optional().or(z.literal("")),
  business_type: z.enum(["sro", "as", "szco", "druzstvo", "ine"]).default("sro"),
  accounting_type: z.enum(["podvojne", "jednoduche"]).default("podvojne"),
  size_category: z.enum(["mikro", "mala", "stredna", "velka"]).default("mikro"),
  is_vat_payer: z.boolean().default(false),
  vat_period: z.enum(["mesacne", "stvrtrocne"]).optional().nullable(),
  registration_court: z.string().optional().or(z.literal("")),
  section_insert: z.string().optional().or(z.literal("")),
})

export type CompanyInput = z.input<typeof companySchema>
export type CompanyOutput = z.output<typeof companySchema>

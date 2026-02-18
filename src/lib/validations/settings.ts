import { z } from "zod"

// --- Company Settings ---
export const companySettingsSchema = z.object({
  name: z.string().min(1, { message: "Nazov firmy je povinny" }),
  ico: z.string().optional().or(z.literal("")),
  dic: z.string().optional().or(z.literal("")),
  ic_dph: z.string().optional().or(z.literal("")),
  address: z.object({
    street: z.string().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    zip: z.string().optional().or(z.literal("")),
    country: z.string().default("SK"),
  }),
  business_type: z.enum(["sro", "as", "szco", "druzstvo", "ine"], {
    message: "Vyberte typ podnikania",
  }),
  accounting_type: z.enum(["podvojne", "jednoduche"], {
    message: "Vyberte typ uctovnictva",
  }),
  is_vat_payer: z.boolean().default(false),
  vat_period: z.enum(["mesacne", "stvrtrocne"], {
    message: "Vyberte obdobie DPH",
  }).optional().nullable(),
  bank_account_iban: z.string().optional().or(z.literal("")),
  bank_bic: z.string().optional().or(z.literal("")),
  logo_url: z.string().optional().or(z.literal("")),
  stamp_url: z.string().optional().or(z.literal("")),
  signature_url: z.string().optional().or(z.literal("")),
  email: z.string().email({ message: "Neplatny email" }).optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  web: z.string().optional().or(z.literal("")),
})

export type CompanySettingsInput = z.input<typeof companySettingsSchema>
export type CompanySettingsOutput = z.output<typeof companySettingsSchema>

// --- Fiscal Year ---
export const fiscalYearSchema = z.object({
  name: z.string().min(1, { message: "Nazov je povinny" }),
  start_date: z.string().min(1, { message: "Datum zaciatku je povinny" }),
  end_date: z.string().min(1, { message: "Datum konca je povinny" }),
  status: z.enum(["active", "closed"], {
    message: "Vyberte stav",
  }).default("active"),
})

export type FiscalYearInput = z.input<typeof fiscalYearSchema>
export type FiscalYearOutput = z.output<typeof fiscalYearSchema>

// --- Document Numbering ---
export const numberingSchema = z.object({
  document_type: z.enum([
    "vydana_faktura",
    "prijata_faktura",
    "dobropis",
    "zalohova",
    "pokladnicny_doklad",
    "ucetny_doklad",
    "objednavka",
    "cenova_ponuka",
    "dodaci_list",
  ], {
    message: "Vyberte typ dokladu",
  }),
  prefix: z.string().min(1, { message: "Predpona je povinna" }),
  suffix: z.string().optional().or(z.literal("")),
  next_number: z.number().int().min(1, { message: "Cislo musi byt kladne" }),
  padding: z.number().int().min(1).max(10).default(4),
  separator: z.string().default(""),
})

export type NumberingInput = z.input<typeof numberingSchema>
export type NumberingOutput = z.output<typeof numberingSchema>

// --- User Role ---
export const userRoleSchema = z.object({
  user_email: z.string().email({ message: "Neplatny email" }),
  role: z.enum(["admin", "uctovnik", "fakturant", "mzdar", "skladnik", "readonly"], {
    message: "Vyberte rolu",
  }),
})

export type UserRoleInput = z.input<typeof userRoleSchema>
export type UserRoleOutput = z.output<typeof userRoleSchema>

// --- API Key ---
export const apiKeySchema = z.object({
  name: z.string().min(1, { message: "Nazov je povinny" }),
  permissions: z.array(z.string()).min(1, { message: "Vyberte aspon jedno opravnenie" }),
})

export type ApiKeyInput = z.input<typeof apiKeySchema>
export type ApiKeyOutput = z.output<typeof apiKeySchema>

// --- Exchange Rate ---
export const exchangeRateSchema = z.object({
  currency_from: z.string().min(1, { message: "Zdrojova mena je povinna" }),
  currency_to: z.string().min(1, { message: "Cielova mena je povinna" }),
  rate: z.number().positive({ message: "Kurz musi byt kladny" }),
  date: z.string().min(1, { message: "Datum je povinny" }),
})

export type ExchangeRateInput = z.input<typeof exchangeRateSchema>
export type ExchangeRateOutput = z.output<typeof exchangeRateSchema>

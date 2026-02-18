import { z } from "zod"

export const contactSchema = z.object({
  type: z.enum(["odberatel", "dodavatel", "oba"]).default("odberatel"),
  name: z.string().min(1, "Názov je povinný"),
  ico: z.string().max(8).optional().or(z.literal("")),
  dic: z.string().max(12).optional().or(z.literal("")),
  ic_dph: z.string().max(14).optional().or(z.literal("")),
  street: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  zip: z.string().max(10).optional().or(z.literal("")),
  country: z.string().max(2).default("SK"),
  email: z.string().email("Neplatný email").optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  web: z.string().optional().or(z.literal("")),
  credit_limit: z.number().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().optional().or(z.literal("")),
})

export type ContactInput = z.input<typeof contactSchema>

export const contactPersonSchema = z.object({
  name: z.string().min(1, "Meno je povinné"),
  position: z.string().optional().or(z.literal("")),
  email: z.string().email("Neplatný email").optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  is_primary: z.boolean().default(false),
})

export const contactBankAccountSchema = z.object({
  iban: z.string().min(1, "IBAN je povinný"),
  bic: z.string().optional().or(z.literal("")),
  bank_name: z.string().optional().or(z.literal("")),
  currency: z.string().default("EUR"),
  is_primary: z.boolean().default(false),
})

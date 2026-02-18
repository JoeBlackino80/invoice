import { z } from "zod"

export const portalLoginSchema = z.object({
  email: z.string().email({ message: "Neplatný email" }),
  token: z.string().min(6, { message: "Prístupový kód musí mať aspoň 6 znakov" }),
})

export const portalContactSchema = z.object({
  contact_id: z.string().min(1, { message: "ID kontaktu je povinné" }),
  company_id: z.string().min(1, { message: "ID firmy je povinné" }),
})

export const paymentLinkSchema = z.object({
  invoice_id: z.string().min(1, { message: "ID faktúry je povinné" }),
  amount: z.number().positive({ message: "Suma musí byť kladná" }),
  currency: z.string().default("EUR"),
  method: z.enum(["stripe", "gopay", "bank_transfer"], {
    message: "Neplatný spôsob platby",
  }),
})

export const portalEmailSchema = z.object({
  email: z.string().email({ message: "Neplatný email" }),
  company_id: z.string().min(1, { message: "ID firmy je povinné" }),
})

export const portalTokenVerifySchema = z.object({
  email: z.string().email({ message: "Neplatný email" }),
  token: z.string().min(6, { message: "Prístupový kód musí mať aspoň 6 znakov" }),
})

export type PortalLoginInput = z.infer<typeof portalLoginSchema>
export type PortalContactInput = z.infer<typeof portalContactSchema>
export type PaymentLinkInput = z.infer<typeof paymentLinkSchema>
export type PortalEmailInput = z.infer<typeof portalEmailSchema>
export type PortalTokenVerifyInput = z.infer<typeof portalTokenVerifySchema>

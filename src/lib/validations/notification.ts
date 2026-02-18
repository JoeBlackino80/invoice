import { z } from "zod"

export const notificationRuleSchema = z.object({
  type: z.enum(
    [
      "invoice_overdue",
      "deadline_approaching",
      "invoice_approved",
      "payment_received",
      "ocr_processed",
      "low_stock",
      "bank_imported",
      "ai_anomaly",
    ],
    { message: "Neplatný typ notifikácie" }
  ),
  enabled: z.boolean(),
  channels: z.object({
    in_app: z.boolean(),
    email: z.boolean(),
  }),
  timing: z.object({
    days_before: z.number().min(0, { message: "Hodnota musí byť nezáporná" }),
    repeat_days: z.number().min(1, { message: "Hodnota musí byť aspoň 1" }).optional(),
  }),
  recipients: z.enum(["all", "admin", "uctovnik", "specific"], {
    message: "Neplatný typ príjemcu",
  }),
})

export const emailTemplateSchema = z.object({
  name: z.string().min(1, { message: "Názov je povinný" }),
  subject: z.string().min(1, { message: "Predmet je povinný" }),
  body_html: z.string().min(1, { message: "Obsah HTML je povinný" }),
  type: z.enum(
    [
      "invoice_overdue",
      "deadline_approaching",
      "invoice_approved",
      "payment_received",
      "ocr_processed",
      "low_stock",
      "bank_imported",
      "ai_anomaly",
    ],
    { message: "Neplatný typ šablóny" }
  ),
})

export type NotificationRuleInput = z.infer<typeof notificationRuleSchema>
export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>

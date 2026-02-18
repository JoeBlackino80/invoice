import { z } from "zod"

export const chartOfAccountSchema = z.object({
  synteticky_ucet: z.string().min(3).max(3), // e.g. "311"
  analyticky_ucet: z.string().max(10).optional(),
  nazov: z.string().min(1),
  typ: z.enum(["aktivny", "pasivny", "vynosovy", "nakladovy"]),
  danovy: z.boolean().default(false),
  podsuvahovovy: z.boolean().default(false),
  aktivny: z.boolean().default(true),
})

export const costCenterSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  active: z.boolean().default(true),
})

export const projectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  active: z.boolean().default(true),
})

export type ChartOfAccountInput = z.input<typeof chartOfAccountSchema>
export type CostCenterInput = z.input<typeof costCenterSchema>
export type ProjectInput = z.input<typeof projectSchema>

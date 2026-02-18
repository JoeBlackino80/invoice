import { z } from "zod"

// ---------- Employee Schema ----------

export const employeeSchema = z.object({
  name: z.string().min(1, "Meno je povinne"),
  surname: z.string().min(1, "Priezvisko je povinne"),
  rodne_cislo: z.string().optional().or(z.literal("")),
  date_of_birth: z.string().min(1, "Datum narodenia je povinny"),
  address_street: z.string().optional().or(z.literal("")),
  address_city: z.string().optional().or(z.literal("")),
  address_zip: z.string().optional().or(z.literal("")),
  iban: z.string().optional().or(z.literal("")),
  id_number: z.string().optional().or(z.literal("")),
  marital_status: z.enum(["slobodny", "zenaty", "rozvedeny", "vdovec"], {
    message: "Neplatny rodinny stav",
  }).default("slobodny"),
  health_insurance: z.enum(["vszp", "union", "dovera"], {
    message: "Neplatna zdravotna poistovna",
  }).default("vszp"),
  sp_registration_number: z.string().optional().or(z.literal("")),
})

export type EmployeeInput = z.input<typeof employeeSchema>

// ---------- Employee Contract Schema ----------

export const employeeContractSchema = z.object({
  employee_id: z.string().min(1, "ID zamestnanca je povinne"),
  contract_type: z.enum(["hpp", "dovp", "dopc", "dobps"], {
    message: "Neplatny typ zmluvy",
  }),
  start_date: z.string().min(1, "Datum zaciatku je povinny"),
  end_date: z.string().optional().or(z.literal("")),
  gross_salary: z.number().min(0, "Hruba mzda musi byt kladne cislo"),
  position: z.string().min(1, "Pozicia je povinna"),
  work_hours_weekly: z.number().min(1).max(48).default(40),
  probation_months: z.number().min(0).max(6).optional(),
})

export type EmployeeContractInput = z.input<typeof employeeContractSchema>

// ---------- Employee Child Schema ----------

export const employeeChildSchema = z.object({
  employee_id: z.string().min(1, "ID zamestnanca je povinne"),
  name: z.string().min(1, "Meno dietata je povinne"),
  date_of_birth: z.string().min(1, "Datum narodenia dietata je povinny"),
  is_student: z.boolean().default(false),
  disability: z.boolean().default(false),
})

export type EmployeeChildInput = z.input<typeof employeeChildSchema>

// ---------- Payroll Run Schema ----------

export const payrollRunSchema = z.object({
  company_id: z.string().min(1, "ID spolocnosti je povinne"),
  period_month: z.number().min(1, "Mesiac musi byt 1-12").max(12, "Mesiac musi byt 1-12"),
  period_year: z.number().min(2000, "Rok musi byt 2000-2100").max(2100, "Rok musi byt 2000-2100"),
})

export type PayrollRunInput = z.input<typeof payrollRunSchema>

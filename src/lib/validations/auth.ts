import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Zadajte platnú emailovú adresu"),
  password: z.string().min(8, "Heslo musí mať minimálne 8 znakov"),
})

export const registerSchema = z.object({
  email: z.string().email("Zadajte platnú emailovú adresu"),
  password: z
    .string()
    .min(8, "Heslo musí mať minimálne 8 znakov")
    .regex(/[A-Z]/, "Heslo musí obsahovať aspoň jedno veľké písmeno")
    .regex(/[0-9]/, "Heslo musí obsahovať aspoň jednu číslicu"),
  confirmPassword: z.string(),
  fullName: z.string().min(2, "Meno musí mať minimálne 2 znaky"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Heslá sa nezhodujú",
  path: ["confirmPassword"],
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>

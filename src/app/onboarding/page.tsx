"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { companySchema, type CompanyInput } from "@/lib/validations/company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useCompanyStore } from "@/lib/stores/company-store"
import { Loader2, Building2, ArrowRight, ArrowLeft, Check } from "lucide-react"

const STEPS = [
  { title: "Údaje firmy", description: "Základné informácie o firme" },
  { title: "Typ účtovníctva", description: "Vyberte typ účtovníctva a DPH" },
  { title: "Bankový účet", description: "Zadajte bankové údaje" },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      country: "SK",
      business_type: "sro",
      accounting_type: "podvojne",
      size_category: "mikro",
      is_vat_payer: false,
    },
  })

  const isVatPayer = watch("is_vat_payer")

  const stepFields: Record<number, (keyof CompanyInput)[]> = {
    0: ["name", "ico", "dic", "street", "city", "zip", "email", "phone", "business_type"],
    1: ["accounting_type", "size_category", "is_vat_payer", "ic_dph", "vat_period"],
    2: ["bank_name", "iban", "bic"],
  }

  const handleNext = async () => {
    const fields = stepFields[step]
    const valid = await trigger(fields)
    if (valid) {
      setStep(step + 1)
    }
  }

  const onSubmit = async (data: CompanyInput) => {
    setLoading(true)
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || "Nastala chyba pri vytváraní firmy.")
      }

      toast({
        title: "Firma vytvorená",
        description: `Firma ${result.name} bola úspešne vytvorená.`,
      })

      // Pre-fetch companies so dashboard doesn't redirect back to onboarding
      try {
        const companiesRes = await fetch("/api/companies")
        if (companiesRes.ok) {
          const companiesData = await companiesRes.json()
          if (companiesData && companiesData.length > 0) {
            const mapped = companiesData.map((item: any) => ({
              id: item.id,
              company_id: item.company_id,
              role: item.role,
              is_default: item.is_default,
              company: item.company,
            }))
            useCompanyStore.getState().setCompanies(mapped)
          }
        }
      } catch {}

      // Force full page reload to ensure dashboard starts fresh with new company data
      window.location.href = "/dashboard"
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error?.message || "Nastala chyba pri vytváraní firmy.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Nastavenie firmy</CardTitle>
          <CardDescription>
            {STEPS[step].description}
          </CardDescription>
          {/* Stepper */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-8 ${i < step ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit, (validationErrors) => {
          // Navigate to the first step with errors
          for (let s = 0; s < STEPS.length; s++) {
            const fields = stepFields[s]
            if (fields.some((f) => validationErrors[f])) {
              setStep(s)
              toast({
                variant: "destructive",
                title: "Chyba vo formulári",
                description: "Prosím opravte chyby v označených poliach.",
              })
              return
            }
          }
        })}>
          <CardContent className="space-y-4">
            {/* Krok 1: Údaje firmy */}
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Názov firmy *</Label>
                  <Input id="name" placeholder="Moja firma s.r.o." {...register("name")} />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ico">IČO</Label>
                    <Input id="ico" placeholder="12345678" maxLength={8} {...register("ico")} />
                    {errors.ico && <p className="text-sm text-destructive">{errors.ico.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dic">DIČ</Label>
                    <Input id="dic" placeholder="1234567890" {...register("dic")} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="street">Ulica a číslo</Label>
                  <Input id="street" placeholder="Hlavná 1" {...register("street")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Mesto</Label>
                    <Input id="city" placeholder="Bratislava" {...register("city")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">PSČ</Label>
                    <Input id="zip" placeholder="811 01" {...register("zip")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="info@firma.sk" {...register("email")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefón</Label>
                    <Input id="phone" placeholder="+421 900 000 000" {...register("phone")} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business_type">Právna forma</Label>
                  <select
                    id="business_type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...register("business_type")}
                  >
                    <option value="sro">s.r.o.</option>
                    <option value="as">a.s.</option>
                    <option value="szco">SZČO</option>
                    <option value="druzstvo">Družstvo</option>
                    <option value="ine">Iné</option>
                  </select>
                </div>
              </>
            )}

            {/* Krok 2: Typ účtovníctva */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="accounting_type">Typ účtovníctva</Label>
                  <select
                    id="accounting_type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...register("accounting_type")}
                  >
                    <option value="podvojne">Podvojné účtovníctvo</option>
                    <option value="jednoduche">Jednoduché účtovníctvo</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="size_category">Veľkostná kategória</Label>
                  <select
                    id="size_category"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...register("size_category")}
                  >
                    <option value="mikro">Mikroúčtovná jednotka</option>
                    <option value="mala">Malá účtovná jednotka</option>
                    <option value="stredna">Stredná účtovná jednotka</option>
                    <option value="velka">Veľká účtovná jednotka</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_vat_payer"
                    className="h-4 w-4 rounded border-input"
                    {...register("is_vat_payer")}
                  />
                  <Label htmlFor="is_vat_payer">Platiteľ DPH</Label>
                </div>
                {isVatPayer && (
                  <>
                    <div className="w-full space-y-2">
                      <Label htmlFor="ic_dph">IČ DPH</Label>
                      <Input id="ic_dph" className="w-full" placeholder="SK1234567890" {...register("ic_dph")} />
                    </div>
                    <div className="w-full space-y-2">
                      <Label htmlFor="vat_period">Zdaňovacie obdobie DPH</Label>
                      <select
                        id="vat_period"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        {...register("vat_period")}
                      >
                        <option value="mesacne">Mesačné</option>
                        <option value="stvrtrocne">Štvrťročné</option>
                      </select>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Krok 3: Bankový účet */}
            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Názov banky</Label>
                  <Input id="bank_name" placeholder="Tatra banka, a.s." {...register("bank_name")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input id="iban" placeholder="SK89 1100 0000 0012 3456 7890" {...register("iban")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bic">BIC / SWIFT</Label>
                  <Input id="bic" placeholder="TATRSKBX" {...register("bic")} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Bankový účet môžete neskôr pridať alebo zmeniť v nastaveniach.
                </p>
              </>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Späť
              </Button>
            ) : (
              <div />
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={handleNext}>
                Ďalej
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vytvoriť firmu
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

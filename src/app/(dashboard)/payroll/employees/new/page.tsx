"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Save,
  User,
  CreditCard,
  Shield,
  Briefcase,
  Baby,
  Plus,
  Trash2,
} from "lucide-react"
import Link from "next/link"

interface ChildForm {
  name: string
  date_of_birth: string
  is_student: boolean
}

export default function NewEmployeePage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  // Osobne udaje
  const [name, setName] = useState("")
  const [surname, setSurname] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [rodneCislo, setRodneCislo] = useState("")
  const [idNumber, setIdNumber] = useState("")
  const [addressStreet, setAddressStreet] = useState("")
  const [addressCity, setAddressCity] = useState("")
  const [addressZip, setAddressZip] = useState("")
  const [maritalStatus, setMaritalStatus] = useState("slobodny")

  // Bankove udaje
  const [iban, setIban] = useState("")

  // Poistenie
  const [healthInsurance, setHealthInsurance] = useState("vszp")
  const [spRegistrationNumber, setSpRegistrationNumber] = useState("")

  // Zmluva
  const [contractType, setContractType] = useState("hpp")
  const [startDate, setStartDate] = useState("")
  const [grossSalary, setGrossSalary] = useState("")
  const [position, setPosition] = useState("")
  const [workHoursWeekly, setWorkHoursWeekly] = useState("40")

  // Deti
  const [children, setChildren] = useState<ChildForm[]>([])

  const addChild = () => {
    setChildren([...children, { name: "", date_of_birth: "", is_student: false }])
  }

  const removeChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index))
  }

  const updateChild = (index: number, field: keyof ChildForm, value: string | boolean) => {
    const updated = [...children]
    updated[index] = { ...updated[index], [field]: value }
    setChildren(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!activeCompanyId) {
      toast({ variant: "destructive", title: "Chyba", description: "Nie je vybrana spolocnost" })
      return
    }

    if (!name || !surname || !dateOfBirth) {
      toast({ variant: "destructive", title: "Chyba", description: "Vyplnte povinne udaje" })
      return
    }

    setSaving(true)

    try {
      // 1. Create employee
      const empRes = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          name,
          surname,
          date_of_birth: dateOfBirth,
          rodne_cislo: rodneCislo,
          id_number: idNumber,
          address_street: addressStreet,
          address_city: addressCity,
          address_zip: addressZip,
          marital_status: maritalStatus,
          iban,
          health_insurance: healthInsurance,
          sp_registration_number: spRegistrationNumber,
        }),
      })

      if (!empRes.ok) {
        const errJson = await empRes.json()
        throw new Error(errJson.error?.toString() || "Nepodarilo sa vytvorit zamestnanca")
      }

      const employee = await empRes.json()

      // 2. Create contract if data provided
      if (startDate && grossSalary && position) {
        const contractRes = await fetch(`/api/employees/${employee.id}/contracts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contract_type: contractType,
            start_date: startDate,
            gross_salary: parseFloat(grossSalary),
            position,
            work_hours_weekly: parseInt(workHoursWeekly) || 40,
          }),
        })

        if (!contractRes.ok) {
          console.error("Failed to create contract")
        }
      }

      // 3. Create children
      for (const child of children) {
        if (child.name && child.date_of_birth) {
          const childRes = await fetch(`/api/employees/${employee.id}/children`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: child.name,
              date_of_birth: child.date_of_birth,
              is_student: child.is_student,
              disability: false,
            }),
          })

          if (!childRes.ok) {
            console.error("Failed to create child")
          }
        }
      }

      toast({ title: "Zamestnanec vytvoreny" })
      router.push("/payroll")
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: err.message || "Nepodarilo sa ulozit zamestnanca",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/payroll">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novy zamestnanec</h1>
          <p className="text-muted-foreground">Vyplnte udaje o novom zamestnancovi</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        {/* Osobne udaje */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Osobne udaje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Meno *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surname">Priezvisko *</Label>
                <Input id="surname" value={surname} onChange={(e) => setSurname(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Datum narodenia *</Label>
                <Input id="date_of_birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rodne_cislo">Rodne cislo</Label>
                <Input id="rodne_cislo" placeholder="napr. 900101/1234" value={rodneCislo} onChange={(e) => setRodneCislo(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_number">Cislo OP</Label>
              <Input id="id_number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="street">Ulica</Label>
                <Input id="street" value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Mesto</Label>
                <Input id="city" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">PSC</Label>
                <Input id="zip" value={addressZip} onChange={(e) => setAddressZip(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="marital_status">Rodinny stav</Label>
              <select
                id="marital_status"
                value={maritalStatus}
                onChange={(e) => setMaritalStatus(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="slobodny">Slobodny/a</option>
                <option value="zenaty">Zenaty / Vydata</option>
                <option value="rozvedeny">Rozvedeny/a</option>
                <option value="vdovec">Vdovec / Vdova</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Bankove udaje */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5" />
              Bankove udaje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input id="iban" placeholder="SK..." value={iban} onChange={(e) => setIban(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Poistenie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Poistenie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="health_insurance">Zdravotna poistovna</Label>
              <select
                id="health_insurance"
                value={healthInsurance}
                onChange={(e) => setHealthInsurance(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="vszp">Vseobecna zdravotna poistovna (VsZP)</option>
                <option value="union">Union zdravotna poistovna</option>
                <option value="dovera">Dovera zdravotna poistovna</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sp_reg">Registracne cislo SP</Label>
              <Input id="sp_reg" value={spRegistrationNumber} onChange={(e) => setSpRegistrationNumber(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Pracovna zmluva */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5" />
              Pracovna zmluva
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contract_type">Typ zmluvy</Label>
              <select
                id="contract_type"
                value={contractType}
                onChange={(e) => setContractType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="hpp">Hlavny pracovny pomer (HPP)</option>
                <option value="dovp">Dohoda o vykonani prace (DoVP)</option>
                <option value="dopc">Dohoda o pracovnej cinnosti (DoPČ)</option>
                <option value="dobps">Dohoda o brigadnickej praci studentov (DoBPŠ)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Datum zaciatku</Label>
                <Input id="start_date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gross_salary">Hruba mzda (EUR)</Label>
                <Input
                  id="gross_salary"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={grossSalary}
                  onChange={(e) => setGrossSalary(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">Pozicia</Label>
                <Input id="position" value={position} onChange={(e) => setPosition(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work_hours">Tyzdenny pracovny cas (hod.)</Label>
                <Input
                  id="work_hours"
                  type="number"
                  min="1"
                  max="48"
                  value={workHoursWeekly}
                  onChange={(e) => setWorkHoursWeekly(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deti (danovy bonus) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Baby className="h-5 w-5" />
              Deti (pre danovy bonus)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {children.map((child, index) => (
              <div key={index} className="flex items-end gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex-1 space-y-2">
                  <Label>Meno dietata</Label>
                  <Input
                    value={child.name}
                    onChange={(e) => updateChild(index, "name", e.target.value)}
                    placeholder="Meno a priezvisko"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Datum narodenia</Label>
                  <Input
                    type="date"
                    value={child.date_of_birth}
                    onChange={(e) => updateChild(index, "date_of_birth", e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <input
                    type="checkbox"
                    id={`student-${index}`}
                    checked={child.is_student}
                    onChange={(e) => updateChild(index, "is_student", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor={`student-${index}`} className="text-sm whitespace-nowrap">Student</Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive shrink-0"
                  onClick={() => removeChild(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addChild}>
              <Plus className="mr-2 h-4 w-4" />
              Pridat dieta
            </Button>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Ukladam..." : "Ulozit zamestnanca"}
          </Button>
          <Link href="/payroll">
            <Button type="button" variant="outline">Zrusit</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Pencil,
  Trash2,
  User,
  Briefcase,
  Baby,
  Plus,
  Calculator,
  Save,
  X,
} from "lucide-react"

// ---------- types ----------

interface EmployeeContract {
  id: string
  contract_type: string
  start_date: string
  end_date: string | null
  gross_salary: number
  position: string
  work_hours_weekly: number
  probation_months: number | null
}

interface EmployeeChild {
  id: string
  name: string
  date_of_birth: string
  is_student: boolean
  disability: boolean
}

interface EmployeeDetail {
  id: string
  name: string
  surname: string
  rodne_cislo: string | null
  date_of_birth: string
  address_street: string | null
  address_city: string | null
  address_zip: string | null
  iban: string | null
  id_number: string | null
  marital_status: string
  health_insurance: string
  sp_registration_number: string | null
  active: boolean
  employee_contracts: EmployeeContract[]
  employee_children: EmployeeChild[]
}

const contractTypeLabels: Record<string, string> = {
  hpp: "Hlavny pracovny pomer (HPP)",
  dovp: "Dohoda o vykonani prace (DoVP)",
  dopc: "Dohoda o pracovnej cinnosti (DoPČ)",
  dobps: "Dohoda o brigadnickej praci studentov (DoBPŠ)",
}

const maritalLabels: Record<string, string> = {
  slobodny: "Slobodny/a",
  zenaty: "Zenaty / Vydata",
  rozvedeny: "Rozvedeny/a",
  vdovec: "Vdovec / Vdova",
}

const healthLabels: Record<string, string> = {
  vszp: "VsZP",
  union: "Union",
  dovera: "Dovera",
}

export default function EmployeeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const employeeId = params.id as string

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [editName, setEditName] = useState("")
  const [editSurname, setEditSurname] = useState("")
  const [editDob, setEditDob] = useState("")
  const [editRodneCislo, setEditRodneCislo] = useState("")
  const [editIdNumber, setEditIdNumber] = useState("")
  const [editStreet, setEditStreet] = useState("")
  const [editCity, setEditCity] = useState("")
  const [editZip, setEditZip] = useState("")
  const [editIban, setEditIban] = useState("")
  const [editMarital, setEditMarital] = useState("")
  const [editHealth, setEditHealth] = useState("")
  const [editSpReg, setEditSpReg] = useState("")

  // Add child form
  const [showAddChild, setShowAddChild] = useState(false)
  const [newChildName, setNewChildName] = useState("")
  const [newChildDob, setNewChildDob] = useState("")
  const [newChildStudent, setNewChildStudent] = useState(false)

  const fetchEmployee = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}`)
      if (res.ok) {
        const data = await res.json()
        setEmployee(data)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: "Zamestnanec nebol najdeny" })
        router.push("/payroll")
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat zamestnanca" })
    } finally {
      setLoading(false)
    }
  }, [employeeId, toast, router])

  useEffect(() => {
    fetchEmployee()
  }, [fetchEmployee])

  const startEditing = () => {
    if (!employee) return
    setEditName(employee.name)
    setEditSurname(employee.surname)
    setEditDob(employee.date_of_birth)
    setEditRodneCislo(employee.rodne_cislo || "")
    setEditIdNumber(employee.id_number || "")
    setEditStreet(employee.address_street || "")
    setEditCity(employee.address_city || "")
    setEditZip(employee.address_zip || "")
    setEditIban(employee.iban || "")
    setEditMarital(employee.marital_status)
    setEditHealth(employee.health_insurance)
    setEditSpReg(employee.sp_registration_number || "")
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          surname: editSurname,
          date_of_birth: editDob,
          rodne_cislo: editRodneCislo,
          id_number: editIdNumber,
          address_street: editStreet,
          address_city: editCity,
          address_zip: editZip,
          iban: editIban,
          marital_status: editMarital,
          health_insurance: editHealth,
          sp_registration_number: editSpReg,
        }),
      })

      if (res.ok) {
        toast({ title: "Zamestnanec aktualizovany" })
        setEditing(false)
        fetchEmployee()
      } else {
        const errJson = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: errJson.error?.toString() || "Nepodarilo sa ulozit" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit zamestnanca" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Naozaj chcete odstranit tohto zamestnanca?")) return
    const res = await fetch(`/api/employees/${employeeId}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Zamestnanec odstraneny" })
      router.push("/payroll")
    } else {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit zamestnanca" })
    }
  }

  const handleAddChild = async () => {
    if (!newChildName || !newChildDob) return

    const res = await fetch(`/api/employees/${employeeId}/children`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newChildName,
        date_of_birth: newChildDob,
        is_student: newChildStudent,
        disability: false,
      }),
    })

    if (res.ok) {
      toast({ title: "Dieta pridane" })
      setShowAddChild(false)
      setNewChildName("")
      setNewChildDob("")
      setNewChildStudent(false)
      fetchEmployee()
    } else {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa pridat dieta" })
    }
  }

  const handleRemoveChild = async (childId: string) => {
    if (!confirm("Naozaj chcete odstranit toto dieta?")) return

    const res = await fetch(`/api/employees/${employeeId}/children`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ child_id: childId }),
    })

    if (res.ok) {
      toast({ title: "Dieta odstranene" })
      fetchEmployee()
    } else {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit dieta" })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-muted-foreground">Nacitavam...</p>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-muted-foreground">Zamestnanec nebol najdeny</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/payroll">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {employee.name} {employee.surname}
            </h1>
            <p className="text-muted-foreground">
              Detail zamestnanca
              {!employee.active && (
                <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
                  Neaktivny
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <Button variant="outline" onClick={startEditing}>
                <Pencil className="mr-2 h-4 w-4" />
                Upravit
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Odstranit
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Ukladam..." : "Ulozit"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                <X className="mr-2 h-4 w-4" />
                Zrusit
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* Employee Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Osobne udaje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Meno</Label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Priezvisko</Label>
                    <Input value={editSurname} onChange={(e) => setEditSurname(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Datum narodenia</Label>
                    <Input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rodne cislo</Label>
                    <Input value={editRodneCislo} onChange={(e) => setEditRodneCislo(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cislo OP</Label>
                  <Input value={editIdNumber} onChange={(e) => setEditIdNumber(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Ulica</Label>
                    <Input value={editStreet} onChange={(e) => setEditStreet(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Mesto</Label>
                    <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>PSC</Label>
                    <Input value={editZip} onChange={(e) => setEditZip(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>IBAN</Label>
                    <Input value={editIban} onChange={(e) => setEditIban(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rodinny stav</Label>
                    <select
                      value={editMarital}
                      onChange={(e) => setEditMarital(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="slobodny">Slobodny/a</option>
                      <option value="zenaty">Zenaty / Vydata</option>
                      <option value="rozvedeny">Rozvedeny/a</option>
                      <option value="vdovec">Vdovec / Vdova</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Zdravotna poistovna</Label>
                    <select
                      value={editHealth}
                      onChange={(e) => setEditHealth(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="vszp">VsZP</option>
                      <option value="union">Union</option>
                      <option value="dovera">Dovera</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Registracne cislo SP</Label>
                    <Input value={editSpReg} onChange={(e) => setEditSpReg(e.target.value)} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Meno:</span>{" "}
                  <span className="font-medium">{employee.name} {employee.surname}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Datum narodenia:</span>{" "}
                  <span className="font-medium">{employee.date_of_birth}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Rodne cislo:</span>{" "}
                  <span className="font-medium">{employee.rodne_cislo || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cislo OP:</span>{" "}
                  <span className="font-medium">{employee.id_number || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Adresa:</span>{" "}
                  <span className="font-medium">
                    {[employee.address_street, employee.address_city, employee.address_zip].filter(Boolean).join(", ") || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Rodinny stav:</span>{" "}
                  <span className="font-medium">{maritalLabels[employee.marital_status] || employee.marital_status}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">IBAN:</span>{" "}
                  <span className="font-medium">{employee.iban || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zdravotna poistovna:</span>{" "}
                  <span className="font-medium">{healthLabels[employee.health_insurance] || employee.health_insurance}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Registracne cislo SP:</span>{" "}
                  <span className="font-medium">{employee.sp_registration_number || "-"}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contracts Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5" />
              Pracovne zmluvy
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium">Typ zmluvy</th>
                    <th className="h-10 px-4 text-left font-medium">Pozicia</th>
                    <th className="h-10 px-4 text-left font-medium">Od</th>
                    <th className="h-10 px-4 text-left font-medium">Do</th>
                    <th className="h-10 px-4 text-right font-medium">Hruba mzda</th>
                    <th className="h-10 px-4 text-right font-medium">Hodiny/tyzd.</th>
                  </tr>
                </thead>
                <tbody>
                  {(employee.employee_contracts || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="h-16 text-center text-muted-foreground">
                        Ziadne zmluvy
                      </td>
                    </tr>
                  ) : (
                    employee.employee_contracts.map((contract) => (
                      <tr key={contract.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            contract.contract_type === "hpp"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              : contract.contract_type === "dovp"
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : contract.contract_type === "dopc"
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                              : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                          }`}>
                            {contractTypeLabels[contract.contract_type] || contract.contract_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">{contract.position}</td>
                        <td className="px-4 py-3">{contract.start_date}</td>
                        <td className="px-4 py-3">{contract.end_date || "neurcito"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {contract.gross_salary.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} EUR
                        </td>
                        <td className="px-4 py-3 text-right">{contract.work_hours_weekly}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Children List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Baby className="h-5 w-5" />
                Deti (danovy bonus)
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAddChild(!showAddChild)}>
                <Plus className="mr-1 h-4 w-4" />
                Pridat dieta
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showAddChild && (
              <div className="flex items-end gap-3 p-3 mb-4 rounded-lg border bg-muted/30">
                <div className="flex-1 space-y-2">
                  <Label>Meno dietata</Label>
                  <Input
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                    placeholder="Meno a priezvisko"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Datum narodenia</Label>
                  <Input
                    type="date"
                    value={newChildDob}
                    onChange={(e) => setNewChildDob(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <input
                    type="checkbox"
                    id="new-child-student"
                    checked={newChildStudent}
                    onChange={(e) => setNewChildStudent(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="new-child-student" className="text-sm whitespace-nowrap">Student</Label>
                </div>
                <Button size="sm" onClick={handleAddChild}>Pridat</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddChild(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {(employee.employee_children || []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Ziadne deti evidovane</p>
            ) : (
              <div className="space-y-2">
                {employee.employee_children.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium text-sm">{child.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Nar.: {child.date_of_birth}
                          {child.is_student && " | Student"}
                          {child.disability && " | ZTP"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-8 w-8"
                      onClick={() => handleRemoveChild(child.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Links */}
        <div className="flex gap-3">
          <Link href={`/payroll/history?employee_id=${employeeId}`}>
            <Button variant="outline">
              <Calculator className="mr-2 h-4 w-4" />
              Historia vyplat
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

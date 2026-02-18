"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Plus,
  Search,
  Users,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calculator,
  FileText,
  Briefcase,
  GraduationCap,
  UserCheck,
  UserX,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// ---------- types ----------

interface EmployeeContract {
  id: string
  contract_type: string
  start_date: string
  end_date: string | null
  gross_salary: number
  position: string
}

interface Employee {
  id: string
  name: string
  surname: string
  date_of_birth: string
  address_city: string | null
  active: boolean
  employee_contracts: EmployeeContract[]
}

// ---------- labels ----------

const contractTypeLabels: Record<string, string> = {
  hpp: "HPP",
  dovp: "DoVP",
  dopc: "DoPČ",
  dobps: "DoBPŠ",
}

const statusFilters = [
  { value: "vsetky", label: "Všetci", icon: Users },
  { value: "active", label: "Aktívni", icon: UserCheck },
  { value: "inactive", label: "Neaktívni", icon: UserX },
]

const contractFilters = [
  { value: "vsetky", label: "Všetky" },
  { value: "hpp", label: "HPP" },
  { value: "dovp", label: "DoVP" },
  { value: "dopc", label: "DoPČ" },
  { value: "dobps", label: "DoBPŠ" },
]

type Tab = "zamestnanci" | "spracovanie" | "vykazy"

// ---------- component ----------

export default function PayrollPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<Tab>("zamestnanci")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("vsetky")
  const [contractFilter, setContractFilter] = useState("vsetky")
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchEmployees = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "25",
      })
      if (search) params.set("search", search)
      if (statusFilter !== "vsetky") params.set("status", statusFilter)
      if (contractFilter !== "vsetky") params.set("contract_type", contractFilter)

      const res = await fetch(`/api/employees?${params}`)
      const json = await res.json()

      if (res.ok) {
        setEmployees(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat zamestnancov" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, search, statusFilter, contractFilter, pagination.page, toast])

  useEffect(() => {
    if (activeTab === "zamestnanci") {
      fetchEmployees()
    }
  }, [fetchEmployees, activeTab])

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tohto zamestnanca?")) return
    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Zamestnanec odstraneny" })
      fetchEmployees()
    } else {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit zamestnanca" })
    }
    setMenuOpen(null)
  }

  const getActiveContract = (emp: Employee): EmployeeContract | null => {
    const contracts = emp.employee_contracts || []
    return contracts.find((c) => !c.end_date) || contracts[0] || null
  }

  // ---------- tabs ----------

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "zamestnanci", label: "Zamestnanci", icon: Users },
    { id: "spracovanie", label: "Spracovanie miezd", icon: Calculator },
    { id: "vykazy", label: "Vykazy", icon: FileText },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mzdy a personalny modul</h1>
          <p className="text-muted-foreground">Sprava zamestnancov, miezd a vykazov</p>
        </div>
        <Link href="/payroll/employees/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novy zamestnanec
          </Button>
        </Link>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Zamestnanci */}
      {activeTab === "zamestnanci" && (
        <>
          {/* Filtre */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Hladat podla mena, priezviska..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {statusFilters.map((f) => (
                <Button
                  key={f.value}
                  variant={statusFilter === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setStatusFilter(f.value)
                    setPagination((prev) => ({ ...prev, page: 1 }))
                  }}
                >
                  <f.icon className="mr-1 h-4 w-4" />
                  {f.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              {contractFilters.map((f) => (
                <Button
                  key={f.value}
                  variant={contractFilter === f.value ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setContractFilter(f.value)
                    setPagination((prev) => ({ ...prev, page: 1 }))
                  }}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Tabulka zamestnancov */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Meno</th>
                      <th className="h-10 px-4 text-left font-medium">Priezvisko</th>
                      <th className="h-10 px-4 text-left font-medium">Pozicia</th>
                      <th className="h-10 px-4 text-left font-medium">Typ zmluvy</th>
                      <th className="h-10 px-4 text-right font-medium">Hruba mzda</th>
                      <th className="h-10 px-4 text-center font-medium">Stav</th>
                      <th className="h-10 px-4 text-right font-medium">Akcie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="h-24 text-center text-muted-foreground">
                          Nacitavam...
                        </td>
                      </tr>
                    ) : employees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="h-24 text-center text-muted-foreground">
                          <div>
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Zatial nemate ziadnych zamestnancov.</p>
                            <Link href="/payroll/employees/new" className="text-primary hover:underline text-sm">
                              Pridat prveho zamestnanca
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      employees.map((emp) => {
                        const contract = getActiveContract(emp)
                        return (
                          <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <Link href={`/payroll/employees/${emp.id}`} className="font-medium hover:text-primary">
                                {emp.name}
                              </Link>
                            </td>
                            <td className="px-4 py-3">{emp.surname}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {contract?.position || "-"}
                            </td>
                            <td className="px-4 py-3">
                              {contract ? (
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
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {contract
                                ? `${contract.gross_salary.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} EUR`
                                : "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                emp.active
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                              }`}>
                                {emp.active ? "Aktivny" : "Neaktivny"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="relative inline-block">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setMenuOpen(menuOpen === emp.id ? null : emp.id)}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                                {menuOpen === emp.id && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                                    <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
                                      <Link
                                        href={`/payroll/employees/${emp.id}`}
                                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                        onClick={() => setMenuOpen(null)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Detail
                                      </Link>
                                      <button
                                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                        onClick={() => handleDelete(emp.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Odstranit
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Strankovanie */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    {pagination.total} zamestnancov celkovo
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    >
                      Predchadzajuca
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    >
                      Dalsia
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Tab: Spracovanie miezd */}
      {activeTab === "spracovanie" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Spracovanie miezd
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Vytvorte novu vyplatnu listinu pre zvolene obdobie. System automaticky vypocita
                mzdy pre vsetkych aktivnych zamestnancov.
              </p>
              <Link href="/payroll/run">
                <Button>
                  <Calculator className="mr-2 h-4 w-4" />
                  Nova vyplatna listina
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Historia vyplat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Prezrite si historiu spracovanych vyplatnych listin a vyplatnych pasiek.
              </p>
              <Link href="/payroll/history">
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Zobrazit historiu
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Vykazy */}
      {activeTab === "vykazy" && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mesacny prehled miezd</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm mb-4">
                Suhrn vsetkych miezd za zvolene mesacne obdobie.
              </p>
              <Link href="/payroll/reports/monthly">
                <Button variant="outline" size="sm">Zobrazit</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Odvodove povinnosti</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm mb-4">
                Prehled odvodov do ZP a SP za obdobie.
              </p>
              <Link href="/payroll/reports/contributions">
                <Button variant="outline" size="sm">Zobrazit</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Uctovne zapisy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm mb-4">
                Automaticky generovane uctovne zapisy zo mzdoveho modulu.
              </p>
              <Link href="/payroll/reports/accounting">
                <Button variant="outline" size="sm">Zobrazit</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

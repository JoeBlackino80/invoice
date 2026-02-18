"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  MapPin,
  User,
  Car,
  Plane,
  Globe,
  Home,
  Plus,
  Trash2,
  Calculator,
  FileText,
  Banknote,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  calculateTripHours,
  FOREIGN_PER_DIEM_RATES,
} from "@/lib/travel/travel-calculator"

// ---------- types ----------

interface TravelExpense {
  id: string
  expense_type: string
  amount: number
  currency: string
  description: string | null
  receipt_url: string | null
}

interface TravelSettlement {
  id: string
  total_expenses: number
  meal_allowance: number
  vehicle_compensation: number
  accommodation: number
  other_expenses: number
  advance_amount: number
  difference: number
  settlement_date: string
}

interface TravelOrderDetail {
  id: string
  company_id: string
  employee_id: string
  type: "tuzemsky" | "zahranicny"
  purpose: string
  destination: string
  country: string | null
  departure_date: string
  departure_time: string
  arrival_date: string
  arrival_time: string
  transport_type: string
  vehicle_plate: string | null
  vehicle_consumption: number | null
  distance_km: number | null
  fuel_price: number | null
  advance_amount: number | null
  advance_currency: string
  status: string
  total_amount: number | null
  travel_expenses: TravelExpense[]
  travel_settlements: TravelSettlement[]
  employee: {
    id: string
    name: string
    surname: string
    address_city: string | null
    iban: string | null
  } | null
}

// ---------- labels ----------

const statusLabels: Record<string, string> = {
  draft: "Koncept",
  approved: "Schvaleny",
  completed: "Dokonceny",
  settled: "Vyuctovany",
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  completed:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  settled:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
}

const expenseTypeLabels: Record<string, string> = {
  stravne: "Stravne",
  ubytovanie: "Ubytovanie",
  cestovne: "Cestovne",
  parkovne: "Parkovne",
  dialnicna_znamka: "Dialnicna znamka",
  mhd: "MHD",
  poistenie: "Poistenie",
  ine: "Ine",
}

const transportTypeLabels: Record<string, string> = {
  vlastne_auto: "Vlastne auto",
  sluzbne_auto: "Sluzbne auto",
  vlak: "Vlak",
  autobus: "Autobus",
  lietadlo: "Lietadlo",
  iny: "Iny",
}

// ---------- component ----------

export default function TravelOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const orderId = params.id as string

  const [order, setOrder] = useState<TravelOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // New expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [newExpenseType, setNewExpenseType] = useState("ubytovanie")
  const [newExpenseAmount, setNewExpenseAmount] = useState("")
  const [newExpenseCurrency, setNewExpenseCurrency] = useState("EUR")
  const [newExpenseDescription, setNewExpenseDescription] = useState("")

  const fetchOrder = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/travel-orders/${orderId}`)
      const json = await res.json()
      if (res.ok) {
        setOrder(json)
      } else {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: "Cestovny prikaz nebol najdeny",
        })
        router.push("/travel")
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa nacitat cestovny prikaz",
      })
    } finally {
      setLoading(false)
    }
  }, [orderId, router, toast])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const handleApprove = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/travel-orders/${orderId}/approve`, {
        method: "POST",
      })
      if (res.ok) {
        toast({ title: "Cestovny prikaz schvaleny" })
        fetchOrder()
      } else {
        const json = await res.json()
        toast({
          variant: "destructive",
          title: "Chyba",
          description: json.error,
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa schvalit",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleComplete = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/travel-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...order,
          status: "completed",
        }),
      })
      if (res.ok) {
        toast({ title: "Cestovny prikaz oznaceny ako dokonceny" })
        fetchOrder()
      } else {
        // If can't update status via PUT (not draft), try direct update
        // Note: In production, this would be a separate endpoint
        toast({
          variant: "destructive",
          title: "Chyba",
          description: "Nie je mozne zmenit stav",
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa aktualizovat stav",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSettle = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/travel-orders/${orderId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (res.ok) {
        toast({
          title: "Vyuctovanie dokoncene",
          description: json.summary?.difference_label,
        })
        fetchOrder()
      } else {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: json.error,
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa vyuctovat",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddExpense = async () => {
    if (!newExpenseAmount || parseFloat(newExpenseAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Zadajte platnu sumu",
      })
      return
    }

    try {
      const res = await fetch(`/api/travel-orders/${orderId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_type: newExpenseType,
          amount: parseFloat(newExpenseAmount),
          currency: newExpenseCurrency,
          description: newExpenseDescription || undefined,
        }),
      })
      if (res.ok) {
        toast({ title: "Vydavok pridany" })
        setShowExpenseForm(false)
        setNewExpenseAmount("")
        setNewExpenseDescription("")
        fetchOrder()
      } else {
        const json = await res.json()
        toast({
          variant: "destructive",
          title: "Chyba",
          description: json.error || "Nepodarilo sa pridat vydavok",
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa pridat vydavok",
      })
    }
  }

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Naozaj chcete odstranit tento vydavok?")) return
    try {
      const res = await fetch(`/api/travel-orders/${orderId}/expenses`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expense_id: expenseId }),
      })
      if (res.ok) {
        toast({ title: "Vydavok odstraneny" })
        fetchOrder()
      } else {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: "Nepodarilo sa odstranit vydavok",
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa odstranit vydavok",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Nacitavam...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cestovny prikaz nebol najdeny</p>
      </div>
    )
  }

  const tripHours = (() => {
    try {
      const dep = new Date(`${order.departure_date}T${order.departure_time}`)
      const arr = new Date(`${order.arrival_date}T${order.arrival_time}`)
      return Math.round(calculateTripHours(dep, arr) * 10) / 10
    } catch {
      return 0
    }
  })()

  const totalExpenses = (order.travel_expenses || []).reduce(
    (sum, e) => sum + (e.amount || 0),
    0
  )

  const settlement = order.travel_settlements?.[0] || null

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "0.00"
    return amount.toLocaleString("sk-SK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString("sk-SK")
    } catch {
      return date
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/travel">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              Cestovny prikaz
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                statusColors[order.status] || ""
              }`}
            >
              {statusLabels[order.status] || order.status}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                order.type === "zahranicny"
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300"
                  : "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300"
              }`}
            >
              {order.type === "zahranicny" ? (
                <Globe className="mr-1 h-3 w-3" />
              ) : (
                <Home className="mr-1 h-3 w-3" />
              )}
              {order.type === "zahranicny" ? "Zahranicny" : "Tuzemsky"}
            </span>
          </div>
          <p className="text-muted-foreground">{order.purpose}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {order.status === "draft" && (
            <Button
              onClick={handleApprove}
              disabled={actionLoading}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Schvalit
            </Button>
          )}
          {order.status === "approved" && (
            <Button
              variant="outline"
              onClick={handleComplete}
              disabled={actionLoading}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Oznacit ako dokonceny
            </Button>
          )}
          {(order.status === "completed" || order.status === "approved") && (
            <Button onClick={handleSettle} disabled={actionLoading}>
              <Calculator className="mr-2 h-4 w-4" />
              Vyuctovat
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column – details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Zakladne udaje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Zamestnanec</p>
                    <p className="font-medium">
                      {order.employee
                        ? `${order.employee.name} ${order.employee.surname}`
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Destinacia</p>
                    <p className="font-medium">
                      {order.destination}
                      {order.country &&
                        FOREIGN_PER_DIEM_RATES[order.country] && (
                          <span className="text-muted-foreground text-sm">
                            {" "}
                            (
                            {FOREIGN_PER_DIEM_RATES[order.country].country_sk})
                          </span>
                        )}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Odchod / Prichod
                    </p>
                    <p className="font-medium">
                      {formatDate(order.departure_date)} {order.departure_time}{" "}
                      - {formatDate(order.arrival_date)} {order.arrival_time}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Trvanie: {tripHours} hod
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Car className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Doprava</p>
                    <p className="font-medium">
                      {transportTypeLabels[order.transport_type] ||
                        order.transport_type}
                    </p>
                    {order.vehicle_plate && (
                      <p className="text-sm text-muted-foreground">
                        ECV: {order.vehicle_plate}
                      </p>
                    )}
                    {order.distance_km && (
                      <p className="text-sm text-muted-foreground">
                        Vzdialenost: {order.distance_km} km
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Expenses table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Banknote className="h-5 w-5" />
                  Vydavky
                </CardTitle>
                {order.status !== "settled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowExpenseForm(!showExpenseForm)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Pridat vydavok
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Add expense form */}
              {showExpenseForm && (
                <div className="mb-4 p-4 border rounded-md bg-muted/30 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <Label>Typ vydavku</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={newExpenseType}
                        onChange={(e) => setNewExpenseType(e.target.value)}
                      >
                        {Array.from(Object.entries(expenseTypeLabels)).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div>
                      <Label>Suma</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newExpenseAmount}
                        onChange={(e) => setNewExpenseAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Mena</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={newExpenseCurrency}
                        onChange={(e) => setNewExpenseCurrency(e.target.value)}
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="CHF">CHF</option>
                        <option value="CZK">CZK</option>
                      </select>
                    </div>
                    <div>
                      <Label>Popis</Label>
                      <Input
                        placeholder="Volitelny popis"
                        value={newExpenseDescription}
                        onChange={(e) =>
                          setNewExpenseDescription(e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowExpenseForm(false)}
                    >
                      Zrusit
                    </Button>
                    <Button size="sm" onClick={handleAddExpense}>
                      Pridat
                    </Button>
                  </div>
                </div>
              )}

              {/* Expenses list */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-9 px-3 text-left font-medium">
                        Typ
                      </th>
                      <th className="h-9 px-3 text-left font-medium">
                        Popis
                      </th>
                      <th className="h-9 px-3 text-right font-medium">
                        Suma
                      </th>
                      <th className="h-9 px-3 text-center font-medium">
                        Mena
                      </th>
                      {order.status !== "settled" && (
                        <th className="h-9 px-3 text-right font-medium">
                          Akcie
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(order.travel_expenses || []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={order.status !== "settled" ? 5 : 4}
                          className="h-16 text-center text-muted-foreground"
                        >
                          Zatial neboli pridane ziadne vydavky
                        </td>
                      </tr>
                    ) : (
                      (order.travel_expenses || []).map((expense) => (
                        <tr
                          key={expense.id}
                          className="border-b hover:bg-muted/30"
                        >
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                              {expenseTypeLabels[expense.expense_type] ||
                                expense.expense_type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {expense.description || "-"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {formatAmount(expense.amount)}
                          </td>
                          <td className="px-3 py-2 text-center text-xs">
                            {expense.currency}
                          </td>
                          {order.status !== "settled" && (
                            <td className="px-3 py-2 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() =>
                                  handleDeleteExpense(expense.id)
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {(order.travel_expenses || []).length > 0 && (
                    <tfoot>
                      <tr className="border-t font-medium">
                        <td colSpan={2} className="px-3 py-2">
                          Celkom vydavky
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatAmount(totalExpenses)}
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          EUR
                        </td>
                        {order.status !== "settled" && <td />}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Settlement */}
          {settlement && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Vyuctovanie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stravne:</span>
                    <span className="tabular-nums">
                      {formatAmount(settlement.meal_allowance)} EUR
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Nahrada za vozidlo:
                    </span>
                    <span className="tabular-nums">
                      {formatAmount(settlement.vehicle_compensation)} EUR
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ubytovanie:</span>
                    <span className="tabular-nums">
                      {formatAmount(settlement.accommodation)} EUR
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Ostatne vydavky:
                    </span>
                    <span className="tabular-nums">
                      {formatAmount(settlement.other_expenses)} EUR
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Celkove vydavky:</span>
                    <span className="tabular-nums">
                      {formatAmount(settlement.total_expenses)} EUR
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Poskytnuty preddavok:
                    </span>
                    <span className="tabular-nums">
                      {formatAmount(settlement.advance_amount)} EUR
                    </span>
                  </div>
                  <div
                    className={`border-t pt-2 flex justify-between font-bold text-base ${
                      settlement.difference > 0
                        ? "text-red-600 dark:text-red-400"
                        : settlement.difference < 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : ""
                    }`}
                  >
                    <span>
                      {settlement.difference > 0
                        ? "Doplatit zamestnancovi:"
                        : settlement.difference < 0
                          ? "Zamestnanec vracia:"
                          : "Vyrovnane:"}
                    </span>
                    <span className="tabular-nums">
                      {formatAmount(Math.abs(settlement.difference))} EUR
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Datum vyuctovania: {formatDate(settlement.settlement_date)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Accounting entries preview */}
          {settlement && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Uctovne zapisy (nahled)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-9 px-3 text-left font-medium">
                          Popis
                        </th>
                        <th className="h-9 px-3 text-center font-medium">
                          MD
                        </th>
                        <th className="h-9 px-3 text-center font-medium">
                          D
                        </th>
                        <th className="h-9 px-3 text-right font-medium">
                          Suma
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlement.total_expenses > 0 && (
                        <tr className="border-b">
                          <td className="px-3 py-2">
                            Cestovne nahrady - narok
                          </td>
                          <td className="px-3 py-2 text-center font-mono">
                            512
                          </td>
                          <td className="px-3 py-2 text-center font-mono">
                            333
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatAmount(settlement.total_expenses)}
                          </td>
                        </tr>
                      )}
                      {settlement.advance_amount > 0 && (
                        <tr className="border-b">
                          <td className="px-3 py-2">
                            Poskytnuty preddavok
                          </td>
                          <td className="px-3 py-2 text-center font-mono">
                            335
                          </td>
                          <td className="px-3 py-2 text-center font-mono">
                            211
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatAmount(settlement.advance_amount)}
                          </td>
                        </tr>
                      )}
                      {settlement.advance_amount > 0 && (
                        <tr className="border-b">
                          <td className="px-3 py-2">
                            Zuctovanie preddavku
                          </td>
                          <td className="px-3 py-2 text-center font-mono">
                            333
                          </td>
                          <td className="px-3 py-2 text-center font-mono">
                            335
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatAmount(
                              Math.min(
                                settlement.advance_amount,
                                settlement.total_expenses
                              )
                            )}
                          </td>
                        </tr>
                      )}
                      {settlement.difference > 0 && (
                        <tr className="border-b">
                          <td className="px-3 py-2">
                            Doplatok zamestnancovi
                          </td>
                          <td className="px-3 py-2 text-center font-mono">
                            333
                          </td>
                          <td className="px-3 py-2 text-center font-mono">
                            211
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatAmount(settlement.difference)}
                          </td>
                        </tr>
                      )}
                      {settlement.difference < 0 && (
                        <tr className="border-b">
                          <td className="px-3 py-2">
                            Vratka od zamestnanca
                          </td>
                          <td className="px-3 py-2 text-center font-mono">
                            211
                          </td>
                          <td className="px-3 py-2 text-center font-mono">
                            333
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatAmount(Math.abs(settlement.difference))}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  512 - Cestovne nahrady | 333 - Ostatne zavazky voci
                  zamestnancom | 335 - Pohladavky voci zamestnancom | 211 -
                  Pokladnica
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column – summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator className="h-5 w-5" />
                Suhrn
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trvanie cesty:</span>
                <span className="font-medium">{tripHours} hod</span>
              </div>
              {order.distance_km && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vzdialenost:</span>
                  <span>{order.distance_km} km</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vydavky:</span>
                <span className="tabular-nums">
                  {formatAmount(totalExpenses)} EUR
                </span>
              </div>
              {(order.advance_amount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preddavok:</span>
                  <span className="tabular-nums">
                    {formatAmount(order.advance_amount)}{" "}
                    {order.advance_currency}
                  </span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Celkovy odhad:</span>
                <span className="tabular-nums">
                  {formatAmount(order.total_amount)} EUR
                </span>
              </div>
            </CardContent>
          </Card>

          {order.type === "zahranicny" &&
            order.country &&
            FOREIGN_PER_DIEM_RATES[order.country] && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Zahranicna diéta
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Krajina:</span>
                    <span>
                      {FOREIGN_PER_DIEM_RATES[order.country].country_sk}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Denna sadzba:
                    </span>
                    <span className="font-medium">
                      {FOREIGN_PER_DIEM_RATES[order.country].rate}{" "}
                      {FOREIGN_PER_DIEM_RATES[order.country].currency}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Info about status transitions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5" />
                Stavy
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
                <span>
                  <strong>Koncept</strong> - mozno upravovat a mazat
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                <span>
                  <strong>Schvaleny</strong> - cesta bola schvalena
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                <span>
                  <strong>Dokonceny</strong> - cesta prebehla, mozno vyuctovat
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                <span>
                  <strong>Vyuctovany</strong> - finalne vyuctovanie
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

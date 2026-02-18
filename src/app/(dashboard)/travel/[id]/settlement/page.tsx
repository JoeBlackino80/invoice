"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Loader2,
  Calculator,
  BookOpen,
  CheckCircle,
  Car,
  Utensils,
  Hotel,
  Receipt,
} from "lucide-react"

// ---- Pomocne typy a konstanty ----

interface TravelOrder {
  id: string
  number: string
  company_id: string
  employee_id: string
  employee_name: string
  destination: string
  purpose: string
  date_from: string
  date_to: string
  departure_time: string
  arrival_time: string
  transport_type: string
  vehicle_registration?: string
  is_foreign: boolean
  country?: string
  advance_amount: number
  status: string
}

interface MealDay {
  date: string
  hours: number
  baseRate: number
  breakfastFree: boolean
  lunchFree: boolean
  dinnerFree: boolean
  reductionPercent: number
  reductionAmount: number
  finalAmount: number
}

interface AccountingPreview {
  debit_account: string
  credit_account: string
  amount: number
  description: string
}

// Sadzby stravneho podla zakona 283/2002 Z.z. (tuzemske)
const MEAL_RATES = {
  zone_5_12: 7.80,  // 5-12 hodin
  zone_12_18: 11.60, // 12-18 hodin
  zone_18_plus: 17.40, // nad 18 hodin
}

// Sadzby kracenia stravneho
const MEAL_REDUCTION = {
  breakfast: 25, // 25%
  lunch: 40,     // 40%
  dinner: 35,    // 35%
}

// Sadzba nahrady za pouzitie vlastneho motoroveho vozidla
const VEHICLE_RATE_PER_KM = 0.227 // EUR/km

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

function getDaysBetween(from: string, to: string): string[] {
  const days: string[] = []
  const start = new Date(from)
  const end = new Date(to)
  const current = new Date(start)

  while (current <= end) {
    days.push(current.toISOString().split("T")[0])
    current.setDate(current.getDate() + 1)
  }

  return days
}

function getHoursForDay(
  dayDate: string,
  dateFrom: string,
  dateTo: string,
  departureTime: string,
  arrivalTime: string
): number {
  const isFirstDay = dayDate === dateFrom
  const isLastDay = dayDate === dateTo
  const isSingleDay = dateFrom === dateTo

  if (isSingleDay) {
    const depHour = departureTime ? parseInt(departureTime.split(":")[0]) : 8
    const arrHour = arrivalTime ? parseInt(arrivalTime.split(":")[0]) : 17
    return Math.max(0, arrHour - depHour)
  }

  if (isFirstDay) {
    const depHour = departureTime ? parseInt(departureTime.split(":")[0]) : 8
    return Math.max(0, 24 - depHour)
  }

  if (isLastDay) {
    const arrHour = arrivalTime ? parseInt(arrivalTime.split(":")[0]) : 17
    return arrHour
  }

  return 24
}

function getMealRate(hours: number): number {
  if (hours >= 18) return MEAL_RATES.zone_18_plus
  if (hours >= 12) return MEAL_RATES.zone_12_18
  if (hours >= 5) return MEAL_RATES.zone_5_12
  return 0
}

// ---- Hlavna komponenta ----

export default function TravelSettlementPage() {
  const params = useParams()
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [order, setOrder] = useState<TravelOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [settling, setSettling] = useState(false)
  const [accounting, setAccounting] = useState(false)

  // Stravne
  const [mealDays, setMealDays] = useState<MealDay[]>([])

  // Cestovne - vlastne vozidlo
  const [kmDriven, setKmDriven] = useState(0)
  const [fuelConsumption, setFuelConsumption] = useState(6.5) // l/100km
  const [fuelPrice, setFuelPrice] = useState(1.55) // EUR/l

  // Cestovne - verejna doprava
  const [publicTransportCost, setPublicTransportCost] = useState(0)

  // Ubytovanie
  const [accommodationCost, setAccommodationCost] = useState(0)

  // Vedlajsie vydavky
  const [parkingCost, setParkingCost] = useState(0)
  const [highwayCost, setHighwayCost] = useState(0)
  const [otherCost, setOtherCost] = useState(0)

  // Platba
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash")

  // ---- Nacitanie dat ----

  const fetchOrder = useCallback(async () => {
    if (!params.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/travel-orders/${params.id}`)
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: "Cestovny prikaz nebol najdeny",
        })
        return
      }
      const data = await res.json()
      setOrder(data)

      // Inicializacia dnov stravneho
      const days = getDaysBetween(data.date_from, data.date_to)
      const initialMealDays: MealDay[] = days.map((day) => {
        const hours = getHoursForDay(
          day,
          data.date_from,
          data.date_to,
          data.departure_time || "08:00",
          data.arrival_time || "17:00"
        )
        const baseRate = getMealRate(hours)
        return {
          date: day,
          hours,
          baseRate,
          breakfastFree: false,
          lunchFree: false,
          dinnerFree: false,
          reductionPercent: 0,
          reductionAmount: 0,
          finalAmount: baseRate,
        }
      })
      setMealDays(initialMealDays)
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa nacitat cestovny prikaz",
      })
    } finally {
      setLoading(false)
    }
  }, [params.id, toast])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  // ---- Aktualizacia stravneho po zmene checkboxov ----

  const updateMealDay = useCallback(
    (index: number, field: "breakfastFree" | "lunchFree" | "dinnerFree", value: boolean) => {
      setMealDays((prev) => {
        const updated = [...prev]
        const day = { ...updated[index] }
        day[field] = value

        // Prepocitat kracenie
        let reductionPct = 0
        if (day.breakfastFree) reductionPct += MEAL_REDUCTION.breakfast
        if (day.lunchFree) reductionPct += MEAL_REDUCTION.lunch
        if (day.dinnerFree) reductionPct += MEAL_REDUCTION.dinner

        day.reductionPercent = reductionPct
        day.reductionAmount = Math.round(day.baseRate * (reductionPct / 100) * 100) / 100
        day.finalAmount = Math.round((day.baseRate - day.reductionAmount) * 100) / 100

        updated[index] = day
        return updated
      })
    },
    []
  )

  // ---- Vypocty ----

  const mealAllowanceTotal = useMemo(
    () => mealDays.reduce((sum, d) => sum + d.finalAmount, 0),
    [mealDays]
  )

  const isPrivateVehicle = order?.transport_type === "vlastne_auto" || order?.transport_type === "private_vehicle"

  const vehicleFuelCost = useMemo(() => {
    if (!isPrivateVehicle) return 0
    return Math.round(((kmDriven * fuelConsumption) / 100) * fuelPrice * 100) / 100
  }, [kmDriven, fuelConsumption, fuelPrice, isPrivateVehicle])

  const vehicleWearCost = useMemo(() => {
    if (!isPrivateVehicle) return 0
    return Math.round(kmDriven * VEHICLE_RATE_PER_KM * 100) / 100
  }, [kmDriven, isPrivateVehicle])

  const transportTotal = useMemo(() => {
    if (isPrivateVehicle) {
      return vehicleFuelCost + vehicleWearCost
    }
    return publicTransportCost
  }, [isPrivateVehicle, vehicleFuelCost, vehicleWearCost, publicTransportCost])

  const otherTotal = useMemo(
    () => parkingCost + highwayCost + otherCost,
    [parkingCost, highwayCost, otherCost]
  )

  const totalExpenses = useMemo(
    () =>
      Math.round(
        (mealAllowanceTotal + transportTotal + accommodationCost + otherTotal) * 100
      ) / 100,
    [mealAllowanceTotal, transportTotal, accommodationCost, otherTotal]
  )

  const advanceAmount = order?.advance_amount || 0
  const difference = Math.round((totalExpenses - advanceAmount) * 100) / 100

  // ---- Uctovne zapisy preview ----

  const accountingPreview = useMemo((): AccountingPreview[] => {
    const entries: AccountingPreview[] = []

    if (totalExpenses > 0) {
      entries.push({
        debit_account: "512",
        credit_account: "335",
        amount: totalExpenses,
        description: "Cestovne nahrady - naklady",
      })
    }

    if (advanceAmount > 0) {
      if (difference > 0) {
        const creditAcc = paymentMethod === "cash" ? "211" : "221"
        entries.push({
          debit_account: "335",
          credit_account: creditAcc,
          amount: difference,
          description: "Doplatok cestovnych nahrad",
        })
      } else if (difference < 0) {
        const debitAcc = paymentMethod === "cash" ? "211" : "221"
        entries.push({
          debit_account: debitAcc,
          credit_account: "335",
          amount: Math.abs(difference),
          description: "Vratenie preplatku",
        })
      }
    } else {
      if (totalExpenses > 0) {
        const creditAcc = paymentMethod === "cash" ? "211" : "221"
        entries.push({
          debit_account: "335",
          credit_account: creditAcc,
          amount: totalExpenses,
          description: "Uhrada cestovnych nahrad",
        })
      }
    }

    return entries
  }, [totalExpenses, advanceAmount, difference, paymentMethod])

  // ---- Akcie ----

  const handleSettle = async () => {
    if (!order) return
    if (
      !confirm("Naozaj chcete vyuctovat tento cestovny prikaz? Tato akcia je nevratna.")
    )
      return

    setSettling(true)
    try {
      const res = await fetch(`/api/travel-orders/${order.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          free_breakfast: mealDays.some((d) => d.breakfastFree),
          free_lunch: mealDays.some((d) => d.lunchFree),
          free_dinner: mealDays.some((d) => d.dinnerFree),
          payment_method: paymentMethod,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: json.error || "Nepodarilo sa ulozit vyuctovanie",
        })
        return
      }

      toast({ title: "Vyuctovanie bolo uspesne ulozene" })
      setOrder((prev) => (prev ? { ...prev, status: "settled" } : prev))
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa vyuctovat cestovny prikaz",
      })
    } finally {
      setSettling(false)
    }
  }

  const handleAccount = async () => {
    if (!order) return
    if (!confirm("Naozaj chcete zauctovat tento cestovny prikaz?")) return

    setAccounting(true)
    try {
      const res = await fetch(`/api/travel-orders/${order.id}/accounting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: paymentMethod }),
      })

      const json = await res.json()
      if (res.ok) {
        toast({ title: "Cestovny prikaz bol uspesne zauctovany" })
        setOrder((prev) => (prev ? { ...prev, status: "accounted" } : prev))
      } else {
        toast({
          variant: "destructive",
          title: "Chyba pri zauctovani",
          description: json.error || "Nepodarilo sa zauctovat",
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa zauctovat cestovny prikaz",
      })
    } finally {
      setAccounting(false)
    }
  }

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cestovny prikaz nebol najdeny</p>
        <Link href="/travel">
          <Button variant="link">Spat na zoznam</Button>
        </Link>
      </div>
    )
  }

  const isSettled = order.status === "settled" || order.status === "accounted"
  const isAccounted = order.status === "accounted"

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hlavicka */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/travel">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Vyuctovanie cestovneho prikazu
          </h1>
          <p className="text-muted-foreground">
            {order.number || order.id.substring(0, 8)} - {order.destination}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/travel/${order.id}/document`}>
            <Button variant="outline">Dokument</Button>
          </Link>
        </div>
      </div>

      {/* Suhrn cesty */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Suhrn sluzobnej cesty
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Destinacia</p>
              <p className="font-medium">{order.destination}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ucel</p>
              <p className="font-medium">{order.purpose}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Datum</p>
              <p className="font-medium">
                {formatDate(order.date_from)} - {formatDate(order.date_to)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Doprava</p>
              <p className="font-medium">
                {isPrivateVehicle
                  ? `Vlastne vozidlo${order.vehicle_registration ? ` (${order.vehicle_registration})` : ""}`
                  : "Verejna doprava"}
              </p>
            </div>
          </div>
          {order.advance_amount > 0 && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Vyplatena zaloha: {formatMoney(order.advance_amount)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stravne */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            Stravne
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-3 text-left font-medium">Datum</th>
                  <th className="h-10 px-3 text-center font-medium">Hodiny</th>
                  <th className="h-10 px-3 text-right font-medium">Sadzba</th>
                  <th className="h-10 px-3 text-center font-medium">Ranajky</th>
                  <th className="h-10 px-3 text-center font-medium">Obed</th>
                  <th className="h-10 px-3 text-center font-medium">Vecera</th>
                  <th className="h-10 px-3 text-right font-medium">Kracenie</th>
                  <th className="h-10 px-3 text-right font-medium">Stravne</th>
                </tr>
              </thead>
              <tbody>
                {mealDays.map((day, idx) => (
                  <tr key={day.date} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{formatDate(day.date)}</td>
                    <td className="px-3 py-2 text-center">{day.hours}h</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatMoney(day.baseRate)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={day.breakfastFree}
                        onChange={(e) =>
                          updateMealDay(idx, "breakfastFree", e.target.checked)
                        }
                        disabled={isSettled}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={day.lunchFree}
                        onChange={(e) =>
                          updateMealDay(idx, "lunchFree", e.target.checked)
                        }
                        disabled={isSettled}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={day.dinnerFree}
                        onChange={(e) =>
                          updateMealDay(idx, "dinnerFree", e.target.checked)
                        }
                        disabled={isSettled}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {day.reductionPercent > 0
                        ? `-${day.reductionPercent}% (${formatMoney(day.reductionAmount)})`
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium">
                      {formatMoney(day.finalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-medium">
                  <td colSpan={7} className="px-3 py-2 text-right">
                    Stravne spolu:
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold">
                    {formatMoney(mealAllowanceTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Bezne bezne zastavky pri poskytnutom jedle. Kracenie: ranajky 25%, obed 40%,
            vecera 35%.
          </p>
        </CardContent>
      </Card>

      {/* Cestovne */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Car className="h-5 w-5" />
            Cestovne
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isPrivateVehicle ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Najazdene km</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={kmDriven}
                    onChange={(e) => setKmDriven(Number(e.target.value))}
                    disabled={isSettled}
                  />
                </div>
                <div>
                  <Label>Spotreba (l/100km)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={fuelConsumption}
                    onChange={(e) => setFuelConsumption(Number(e.target.value))}
                    disabled={isSettled}
                  />
                </div>
                <div>
                  <Label>Cena paliva (EUR/l)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={fuelPrice}
                    onChange={(e) => setFuelPrice(Number(e.target.value))}
                    disabled={isSettled}
                  />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Naklady na palivo</p>
                  <p className="font-mono font-medium">{formatMoney(vehicleFuelCost)}</p>
                  <p className="text-xs text-muted-foreground">
                    {kmDriven} km x {fuelConsumption} l/100km x {fuelPrice} EUR/l
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Nahrada za opotrebenie</p>
                  <p className="font-mono font-medium">{formatMoney(vehicleWearCost)}</p>
                  <p className="text-xs text-muted-foreground">
                    {kmDriven} km x {VEHICLE_RATE_PER_KM} EUR/km
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Cestovne spolu</p>
                  <p className="font-mono font-bold text-lg">
                    {formatMoney(transportTotal)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Suma za verejnu dopravu (podla dokladov)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={publicTransportCost}
                  onChange={(e) => setPublicTransportCost(Number(e.target.value))}
                  disabled={isSettled}
                />
              </div>
              <p className="text-sm font-mono">
                Cestovne spolu: <strong>{formatMoney(transportTotal)}</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ubytovanie */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Hotel className="h-5 w-5" />
            Ubytovanie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label>Suma za ubytovanie (podla dokladov)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={accommodationCost}
              onChange={(e) => setAccommodationCost(Number(e.target.value))}
              disabled={isSettled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Vedlajsie vydavky */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Vedlajsie vydavky</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Parkovanie</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={parkingCost}
                onChange={(e) => setParkingCost(Number(e.target.value))}
                disabled={isSettled}
              />
            </div>
            <div>
              <Label>Dialnicne poplatky</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={highwayCost}
                onChange={(e) => setHighwayCost(Number(e.target.value))}
                disabled={isSettled}
              />
            </div>
            <div>
              <Label>Ostatne</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={otherCost}
                onChange={(e) => setOtherCost(Number(e.target.value))}
                disabled={isSettled}
              />
            </div>
          </div>
          <p className="text-sm font-mono mt-4">
            Vedlajsie vydavky spolu: <strong>{formatMoney(otherTotal)}</strong>
          </p>
        </CardContent>
      </Card>

      {/* Suhrn */}
      <Card className="mb-6 border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Suhrn vyuctovania
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Stravne</span>
              <span className="font-mono">{formatMoney(mealAllowanceTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Cestovne</span>
              <span className="font-mono">{formatMoney(transportTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Ubytovanie</span>
              <span className="font-mono">{formatMoney(accommodationCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Vedlajsie vydavky</span>
              <span className="font-mono">{formatMoney(otherTotal)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium text-lg">
              <span>Celkove naklady</span>
              <span className="font-mono">{formatMoney(totalExpenses)}</span>
            </div>
            {advanceAmount > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span>Vyplatena zaloha</span>
                  <span className="font-mono">
                    -{formatMoney(advanceAmount)}
                  </span>
                </div>
                <Separator />
                <div
                  className={`flex justify-between font-bold text-lg ${
                    difference > 0
                      ? "text-red-600 dark:text-red-400"
                      : difference < 0
                        ? "text-green-600 dark:text-green-400"
                        : ""
                  }`}
                >
                  <span>
                    {difference > 0
                      ? "Doplatok zamestnancovi"
                      : difference < 0
                        ? "Zamestnanec vracia"
                        : "Vyrovnane"}
                  </span>
                  <span className="font-mono">
                    {formatMoney(Math.abs(difference))}
                  </span>
                </div>
              </>
            )}
          </div>

          <Separator className="my-4" />

          {/* Sposob platby */}
          <div className="flex items-center gap-4">
            <Label>Sposob platby:</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={() => setPaymentMethod("cash")}
                  disabled={isSettled}
                  className="h-4 w-4"
                />
                <span className="text-sm">Hotovost</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="bank"
                  checked={paymentMethod === "bank"}
                  onChange={() => setPaymentMethod("bank")}
                  disabled={isSettled}
                  className="h-4 w-4"
                />
                <span className="text-sm">Bankovy prevod</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Uctovne zapisy preview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Uctovne zapisy (nahlad)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accountingPreview.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ziadne uctovne zapisy na zobrazenie.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-3 text-left font-medium">MD ucet</th>
                    <th className="h-10 px-3 text-left font-medium">D ucet</th>
                    <th className="h-10 px-3 text-right font-medium">Suma</th>
                    <th className="h-10 px-3 text-left font-medium">Popis</th>
                  </tr>
                </thead>
                <tbody>
                  {accountingPreview.map((entry, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono font-medium">
                        {entry.debit_account}
                      </td>
                      <td className="px-3 py-2 font-mono font-medium">
                        {entry.credit_account}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatMoney(entry.amount)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {entry.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Akcie */}
      <div className="flex justify-end gap-3 mb-12">
        {!isSettled && (
          <Button onClick={handleSettle} disabled={settling || totalExpenses <= 0}>
            {settling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Vyuctovat
          </Button>
        )}
        {isSettled && !isAccounted && (
          <Button onClick={handleAccount} disabled={accounting}>
            {accounting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BookOpen className="mr-2 h-4 w-4" />
            )}
            Zauctovat
          </Button>
        )}
        {isAccounted && (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Zauctovane</span>
          </div>
        )}
      </div>
    </div>
  )
}

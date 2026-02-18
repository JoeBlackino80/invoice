"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft,
  Save,
  SendHorizontal,
  Calculator,
  Car,
  Plane,
  Globe,
  Home,
  Clock,
  MapPin,
  User,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  calculateMealAllowance,
  calculateVehicleCompensation,
  calculateTripHours,
  FOREIGN_PER_DIEM_RATES,
} from "@/lib/travel/travel-calculator"

// ---------- types ----------

interface Employee {
  id: string
  name: string
  surname: string
}

const transportTypeLabels: Record<string, string> = {
  vlastne_auto: "Vlastne auto",
  sluzbne_auto: "Sluzbne auto",
  vlak: "Vlak",
  autobus: "Autobus",
  lietadlo: "Lietadlo",
  iny: "Iny",
}

const countryOptions = Array.from(Object.entries(FOREIGN_PER_DIEM_RATES))
  .map(([code, info]) => ({
    code,
    label: `${info.country_sk} (${code})`,
  }))
  .sort((a, b) => a.label.localeCompare(b.label))

// ---------- component ----------

export default function NewTravelOrderPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [saving, setSaving] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeesLoaded, setEmployeesLoaded] = useState(false)

  // Form state
  const [employeeId, setEmployeeId] = useState("")
  const [type, setType] = useState<"tuzemsky" | "zahranicny">("tuzemsky")
  const [purpose, setPurpose] = useState("")
  const [destination, setDestination] = useState("")
  const [country, setCountry] = useState("")
  const [departureDate, setDepartureDate] = useState("")
  const [departureTime, setDepartureTime] = useState("08:00")
  const [arrivalDate, setArrivalDate] = useState("")
  const [arrivalTime, setArrivalTime] = useState("17:00")
  const [transportType, setTransportType] = useState("vlastne_auto")
  const [vehiclePlate, setVehiclePlate] = useState("")
  const [vehicleConsumption, setVehicleConsumption] = useState("")
  const [distanceKm, setDistanceKm] = useState("")
  const [fuelPrice, setFuelPrice] = useState("")
  const [advanceAmount, setAdvanceAmount] = useState("")
  const [advanceCurrency, setAdvanceCurrency] = useState("EUR")

  // Fetch employees
  const loadEmployees = async () => {
    if (!activeCompanyId || employeesLoaded) return
    try {
      const res = await fetch(
        `/api/employees?company_id=${activeCompanyId}&limit=100&status=active`
      )
      const json = await res.json()
      if (res.ok) {
        setEmployees(json.data || [])
      }
    } catch {
      // ignore
    }
    setEmployeesLoaded(true)
  }

  // Load employees on mount
  useState(() => {
    loadEmployees()
  })

  // Auto-calculate trip duration and estimated meal allowance
  const estimation = useMemo(() => {
    if (!departureDate || !arrivalDate || !departureTime || !arrivalTime) {
      return null
    }

    try {
      const dep = new Date(`${departureDate}T${departureTime}`)
      const arr = new Date(`${arrivalDate}T${arrivalTime}`)
      const hours = calculateTripHours(dep, arr)

      if (hours <= 0) return null

      const meal = calculateMealAllowance(
        hours,
        false,
        false,
        false,
        type === "zahranicny",
        type === "zahranicny" ? country : undefined
      )

      let vehicleEst: { total: number } | null = null
      if (
        transportType === "vlastne_auto" &&
        distanceKm &&
        vehicleConsumption &&
        fuelPrice
      ) {
        vehicleEst = calculateVehicleCompensation(
          parseFloat(distanceKm),
          parseFloat(vehicleConsumption),
          parseFloat(fuelPrice)
        )
      }

      return {
        hours: Math.round(hours * 10) / 10,
        days: Math.ceil(hours / 24) || 1,
        mealGross: meal.gross,
        mealNet: meal.net,
        mealCurrency: meal.currency,
        vehicle: vehicleEst?.total ?? 0,
        total: meal.net + (vehicleEst?.total ?? 0),
      }
    } catch {
      return null
    }
  }, [
    departureDate,
    arrivalDate,
    departureTime,
    arrivalTime,
    type,
    country,
    transportType,
    distanceKm,
    vehicleConsumption,
    fuelPrice,
  ])

  const handleSave = async (submitForApproval: boolean) => {
    if (!activeCompanyId) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nie je vybrana spolocnost",
      })
      return
    }

    if (!employeeId || !purpose || !destination || !departureDate || !arrivalDate) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Vyplnte vsetky povinne polia",
      })
      return
    }

    if (type === "zahranicny" && !country) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Pre zahranicnu cestu je potrebne uviest krajinu",
      })
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, any> = {
        company_id: activeCompanyId,
        employee_id: employeeId,
        type,
        purpose,
        destination,
        departure_date: departureDate,
        departure_time: departureTime,
        arrival_date: arrivalDate,
        arrival_time: arrivalTime,
        transport_type: transportType,
        advance_currency: advanceCurrency,
        status: "draft",
      }

      if (type === "zahranicny") {
        payload.country = country
      }

      if (transportType === "vlastne_auto") {
        if (vehiclePlate) payload.vehicle_plate = vehiclePlate
        if (vehicleConsumption)
          payload.vehicle_consumption = parseFloat(vehicleConsumption)
        if (distanceKm) payload.distance_km = parseFloat(distanceKm)
        if (fuelPrice) payload.fuel_price = parseFloat(fuelPrice)
      }

      if (distanceKm && transportType !== "vlastne_auto") {
        payload.distance_km = parseFloat(distanceKm)
      }

      if (advanceAmount) {
        payload.advance_amount = parseFloat(advanceAmount)
      }

      const res = await fetch("/api/travel-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Chyba",
          description:
            typeof json.error === "string"
              ? json.error
              : "Nepodarilo sa vytvorit cestovny prikaz",
        })
        return
      }

      // If submitting for approval, call approve endpoint
      if (submitForApproval && json.id) {
        await fetch(`/api/travel-orders/${json.id}/approve`, {
          method: "POST",
        })
      }

      toast({ title: "Cestovny prikaz vytvoreny" })
      router.push("/travel")
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa vytvorit cestovny prikaz",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/travel">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Novy cestovny prikaz
          </h1>
          <p className="text-muted-foreground">
            Vyplnte udaje o pracovnej ceste
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column – form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Zakladne udaje */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Zakladne udaje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="employee">Zamestnanec *</Label>
                <select
                  id="employee"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                >
                  <option value="">Vyberte zamestnanca</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.surname}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Typ cesty *</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={type === "tuzemsky" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setType("tuzemsky")}
                  >
                    <Home className="mr-1 h-4 w-4" />
                    Tuzemsky
                  </Button>
                  <Button
                    type="button"
                    variant={type === "zahranicny" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setType("zahranicny")}
                  >
                    <Globe className="mr-1 h-4 w-4" />
                    Zahranicny
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="purpose">Ucel cesty *</Label>
                <Input
                  id="purpose"
                  placeholder="Napr. obchodne rokovanie, skolenie..."
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="destination">Destinacia *</Label>
                  <Input
                    id="destination"
                    placeholder="Napr. Praha, Vieden..."
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>
                {type === "zahranicny" && (
                  <div>
                    <Label htmlFor="country">Krajina *</Label>
                    <select
                      id="country"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    >
                      <option value="">Vyberte krajinu</option>
                      {countryOptions.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Datumy a casy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" />
                Datumy a casy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="departure_date">Datum odchodu *</Label>
                  <Input
                    id="departure_date"
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="departure_time">Cas odchodu *</Label>
                  <Input
                    id="departure_time"
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="arrival_date">Datum prichodu *</Label>
                  <Input
                    id="arrival_date"
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="arrival_time">Cas prichodu *</Label>
                  <Input
                    id="arrival_time"
                    type="time"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                  />
                </div>
              </div>

              {estimation && (
                <div className="mt-4 p-3 bg-muted/50 rounded-md text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Trvanie cesty: <strong>{estimation.hours} hodin</strong>
                      {estimation.days > 1 && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({estimation.days} dni)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Doprava */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Car className="h-5 w-5" />
                Doprava
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Typ dopravy *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={transportType}
                  onChange={(e) => setTransportType(e.target.value)}
                >
                  {Array.from(Object.entries(transportTypeLabels)).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {transportType === "vlastne_auto" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="vehicle_plate">ECV vozidla</Label>
                    <Input
                      id="vehicle_plate"
                      placeholder="Napr. BA-123AB"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vehicle_consumption">
                      Spotreba (l/100km)
                    </Label>
                    <Input
                      id="vehicle_consumption"
                      type="number"
                      step="0.1"
                      placeholder="Napr. 6.5"
                      value={vehicleConsumption}
                      onChange={(e) => setVehicleConsumption(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="fuel_price">Cena paliva (EUR/l)</Label>
                    <Input
                      id="fuel_price"
                      type="number"
                      step="0.001"
                      placeholder="Napr. 1.589"
                      value={fuelPrice}
                      onChange={(e) => setFuelPrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="distance_km">
                      Vzdialenost (km)
                    </Label>
                    <Input
                      id="distance_km"
                      type="number"
                      step="1"
                      placeholder="Napr. 350"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {transportType !== "vlastne_auto" && (
                <div className="max-w-xs">
                  <Label htmlFor="distance_km_other">
                    Vzdialenost (km, volitelne)
                  </Label>
                  <Input
                    id="distance_km_other"
                    type="number"
                    step="1"
                    placeholder="Napr. 350"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preddavok */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preddavok</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="advance_amount">Suma preddavku</Label>
                  <Input
                    id="advance_amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="advance_currency">Mena</Label>
                  <select
                    id="advance_currency"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={advanceCurrency}
                    onChange={(e) => setAdvanceCurrency(e.target.value)}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="CHF">CHF</option>
                    <option value="CZK">CZK</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tlacidla */}
          <div className="flex gap-3 justify-end">
            <Link href="/travel">
              <Button variant="outline">Zrusit</Button>
            </Link>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => handleSave(false)}
            >
              <Save className="mr-2 h-4 w-4" />
              Ulozit koncept
            </Button>
            <Button disabled={saving} onClick={() => handleSave(true)}>
              <SendHorizontal className="mr-2 h-4 w-4" />
              Odoslat na schvalenie
            </Button>
          </div>
        </div>

        {/* Right column – preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator className="h-5 w-5" />
                Odhadovane naklady
              </CardTitle>
            </CardHeader>
            <CardContent>
              {estimation ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stravne:</span>
                    <span className="font-medium tabular-nums">
                      {estimation.mealNet.toFixed(2)} {estimation.mealCurrency}
                    </span>
                  </div>
                  {estimation.mealGross !== estimation.mealNet && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>(pred znizenim)</span>
                      <span>{estimation.mealGross.toFixed(2)}</span>
                    </div>
                  )}
                  {estimation.vehicle > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Nahrada za vozidlo:
                      </span>
                      <span className="font-medium tabular-nums">
                        {estimation.vehicle.toFixed(2)} EUR
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Odhad celkovo:</span>
                    <span className="tabular-nums">
                      {estimation.total.toFixed(2)} EUR
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Odhad nezahrna ubytovanie a ostatne vydavky. Finalna suma
                    bude urcena pri vyuctovani.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Vyplnte datumy a casy pre odhad nakladov.
                </p>
              )}
            </CardContent>
          </Card>

          {type === "zahranicny" && country && FOREIGN_PER_DIEM_RATES[country] && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Info o krajine
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Krajina:</span>
                  <span>{FOREIGN_PER_DIEM_RATES[country].country_sk}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Denna diéta:</span>
                  <span className="font-medium">
                    {FOREIGN_PER_DIEM_RATES[country].rate}{" "}
                    {FOREIGN_PER_DIEM_RATES[country].currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Max. vreckove (40%):
                  </span>
                  <span>
                    {(FOREIGN_PER_DIEM_RATES[country].rate * 0.4).toFixed(2)}{" "}
                    {FOREIGN_PER_DIEM_RATES[country].currency}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

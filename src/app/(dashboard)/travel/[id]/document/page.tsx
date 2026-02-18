"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Printer, Loader2 } from "lucide-react"
import type { TravelOrderDocument, TravelSettlementDocument } from "@/lib/travel/travel-pdf-generator"

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

// ---- Komponenta: Cestovny prikaz ----

function TravelOrderView({ doc }: { doc: TravelOrderDocument }) {
  return (
    <div className="space-y-6 print:space-y-4">
      {/* Hlavicka spolocnosti */}
      <div className="text-center border-b pb-4">
        <h2 className="text-xl font-bold">{doc.company.name}</h2>
        <p className="text-sm text-muted-foreground">
          ICO: {doc.company.ico}
          {doc.company.dic ? ` | DIC: ${doc.company.dic}` : ""}
        </p>
        {doc.company.street && (
          <p className="text-sm text-muted-foreground">
            {doc.company.street}, {doc.company.zip} {doc.company.city}
          </p>
        )}
      </div>

      {/* Nazov dokumentu */}
      <div className="text-center">
        <h1 className="text-2xl font-bold uppercase">{doc.document_title}</h1>
        {doc.document_number && (
          <p className="text-lg text-muted-foreground">c. {doc.document_number}</p>
        )}
      </div>

      {/* Udaje o zamestnancovi */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Udaje o zamestnancovi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Meno a priezvisko: </span>
              <span className="font-medium">{doc.employee.name}</span>
            </div>
            {doc.employee.position && (
              <div>
                <span className="text-muted-foreground">Funkcia: </span>
                <span className="font-medium">{doc.employee.position}</span>
              </div>
            )}
            {doc.employee.department && (
              <div>
                <span className="text-muted-foreground">Utvar: </span>
                <span className="font-medium">{doc.employee.department}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Udaje o ceste */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Udaje o sluzobnej ceste
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Miesto plnenia ukolu: </span>
              <span className="font-medium">{doc.trip.destination}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ucel cesty: </span>
              <span className="font-medium">{doc.trip.purpose}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Zaciatok cesty: </span>
              <span className="font-medium">
                {formatDate(doc.trip.date_from)}
                {doc.trip.departure_time ? ` o ${doc.trip.departure_time}` : ""}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Koniec cesty: </span>
              <span className="font-medium">
                {formatDate(doc.trip.date_to)}
                {doc.trip.arrival_time ? ` o ${doc.trip.arrival_time}` : ""}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Dopravny prostriedok: </span>
              <span className="font-medium">{doc.trip.transport_type}</span>
            </div>
            {doc.trip.vehicle_registration && (
              <div>
                <span className="text-muted-foreground">ECV vozidla: </span>
                <span className="font-medium">{doc.trip.vehicle_registration}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Typ cesty: </span>
              <span className="font-medium">
                {doc.trip.is_foreign
                  ? `Zahranicna${doc.trip.country ? ` (${doc.trip.country})` : ""}`
                  : "Tuzemska"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Predpokladane naklady */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Predpokladane naklady
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Stravne</span>
              <span className="font-mono">
                {formatMoney(doc.estimated_costs.meal_allowance)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Cestovne</span>
              <span className="font-mono">
                {formatMoney(doc.estimated_costs.transport)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Ubytovanie</span>
              <span className="font-mono">
                {formatMoney(doc.estimated_costs.accommodation)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Ostatne</span>
              <span className="font-mono">
                {formatMoney(doc.estimated_costs.other)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium">
              <span>Spolu predpokladane naklady</span>
              <span className="font-mono">
                {formatMoney(doc.estimated_costs.total)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zaloha */}
      {doc.advance_amount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Zaloha na sluzobnu cestu</span>
              <span className="font-mono font-medium">
                {formatMoney(doc.advance_amount)}
              </span>
            </div>
            {doc.advance_payment_method && (
              <p className="text-xs text-muted-foreground mt-1">
                Sposob vyplatenia: {doc.advance_payment_method === "cash" ? "hotovost" : "bankovy prevod"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Poznamky */}
      {doc.notes && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Poznamky:</p>
            <p className="text-sm">{doc.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Podpisy */}
      <div className="grid grid-cols-2 gap-8 mt-8 pt-4">
        <div className="text-center">
          <div className="border-b border-dashed mb-2 pb-8" />
          <p className="text-xs text-muted-foreground">Schvalil (datum, podpis)</p>
          {doc.approved_by && (
            <p className="text-xs mt-1">{doc.approved_by}</p>
          )}
          {doc.approval_date && (
            <p className="text-xs text-muted-foreground">
              {formatDate(doc.approval_date)}
            </p>
          )}
        </div>
        <div className="text-center">
          <div className="border-b border-dashed mb-2 pb-8" />
          <p className="text-xs text-muted-foreground">Zamestnanec (datum, podpis)</p>
        </div>
      </div>
    </div>
  )
}

// ---- Komponenta: Vyuctovanie ----

function SettlementView({ doc }: { doc: TravelSettlementDocument }) {
  return (
    <div className="space-y-6 print:space-y-4">
      {/* Hlavicka spolocnosti */}
      <div className="text-center border-b pb-4">
        <h2 className="text-xl font-bold">{doc.company.name}</h2>
        <p className="text-sm text-muted-foreground">
          ICO: {doc.company.ico}
          {doc.company.dic ? ` | DIC: ${doc.company.dic}` : ""}
        </p>
        {doc.company.street && (
          <p className="text-sm text-muted-foreground">
            {doc.company.street}, {doc.company.zip} {doc.company.city}
          </p>
        )}
      </div>

      {/* Nazov dokumentu */}
      <div className="text-center">
        <h1 className="text-2xl font-bold uppercase">{doc.document_title}</h1>
        {doc.document_number && (
          <p className="text-lg text-muted-foreground">c. {doc.document_number}</p>
        )}
        {doc.travel_order_number && (
          <p className="text-sm text-muted-foreground">
            K cestovnemu prikazu c. {doc.travel_order_number}
          </p>
        )}
      </div>

      {/* Zamestnanec */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Zamestnanec
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Meno a priezvisko: </span>
              <span className="font-medium">{doc.employee.name}</span>
            </div>
            {doc.employee.position && (
              <div>
                <span className="text-muted-foreground">Funkcia: </span>
                <span className="font-medium">{doc.employee.position}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Udaje o ceste */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Udaje o sluzobnej ceste
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Destinacia: </span>
              <span className="font-medium">{doc.trip.destination}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ucel: </span>
              <span className="font-medium">{doc.trip.purpose}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Od: </span>
              <span className="font-medium">
                {formatDate(doc.trip.date_from)}
                {doc.trip.departure_time ? ` ${doc.trip.departure_time}` : ""}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Do: </span>
              <span className="font-medium">
                {formatDate(doc.trip.date_to)}
                {doc.trip.arrival_time ? ` ${doc.trip.arrival_time}` : ""}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stravne - dnovy prehlad */}
      {doc.expenses.meal_allowance_days.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stravne - dnovy prehlad
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-8 px-3 text-left font-medium">Datum</th>
                    <th className="h-8 px-3 text-center font-medium">Hod.</th>
                    <th className="h-8 px-3 text-right font-medium">Sadzba</th>
                    <th className="h-8 px-3 text-center font-medium">R</th>
                    <th className="h-8 px-3 text-center font-medium">O</th>
                    <th className="h-8 px-3 text-center font-medium">V</th>
                    <th className="h-8 px-3 text-right font-medium">Kracenie</th>
                    <th className="h-8 px-3 text-right font-medium">Stravne</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.expenses.meal_allowance_days.map((day) => (
                    <tr key={day.date} className="border-b">
                      <td className="px-3 py-1.5">{formatDate(day.date)}</td>
                      <td className="px-3 py-1.5 text-center">{day.hours}</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {formatMoney(day.base_rate)}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {day.breakfast_free ? "X" : ""}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {day.lunch_free ? "X" : ""}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {day.dinner_free ? "X" : ""}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {day.reduction_amount > 0
                          ? `-${formatMoney(day.reduction_amount)}`
                          : "-"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-medium">
                        {formatMoney(day.final_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-medium">
                    <td colSpan={7} className="px-3 py-2 text-right text-xs">
                      Stravne spolu:
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {formatMoney(doc.expenses.meal_allowance_total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-muted-foreground px-3 py-2">
              R = ranajky, O = obed, V = vecera (X = poskytnutie bezplatne - kracenie)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Vozidlo */}
      {doc.expenses.vehicle_compensation && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Nahrada za pouzitie vlastneho vozidla
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Najazdene km:</span>
              <span className="font-mono text-right">
                {doc.expenses.vehicle_compensation.km_driven} km
              </span>
              <span className="text-muted-foreground">Spotreba:</span>
              <span className="font-mono text-right">
                {doc.expenses.vehicle_compensation.fuel_consumption} l/100km
              </span>
              <span className="text-muted-foreground">Cena paliva:</span>
              <span className="font-mono text-right">
                {formatMoney(doc.expenses.vehicle_compensation.fuel_price)}/l
              </span>
              <span className="text-muted-foreground">Naklady na palivo:</span>
              <span className="font-mono text-right">
                {formatMoney(doc.expenses.vehicle_compensation.fuel_cost)}
              </span>
              <span className="text-muted-foreground">
                Nahrada za opotrebenie ({doc.expenses.vehicle_compensation.rate_per_km} EUR/km):
              </span>
              <span className="font-mono text-right">
                {formatMoney(doc.expenses.vehicle_compensation.wear_compensation)}
              </span>
              <Separator className="col-span-2 my-1" />
              <span className="font-medium">Cestovne spolu:</span>
              <span className="font-mono text-right font-medium">
                {formatMoney(doc.expenses.vehicle_compensation.total)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Celkove naklady */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Celkove naklady
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Stravne</span>
              <span className="font-mono">
                {formatMoney(doc.expenses.meal_allowance_total)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Cestovne</span>
              <span className="font-mono">
                {formatMoney(doc.expenses.transport_total)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Ubytovanie</span>
              <span className="font-mono">
                {formatMoney(doc.expenses.accommodation_total)}
              </span>
            </div>
            {doc.expenses.other_total > 0 && (
              <div className="flex justify-between">
                <span>Vedlajsie vydavky</span>
                <span className="font-mono">
                  {formatMoney(doc.expenses.other_total)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Celkove naklady</span>
              <span className="font-mono">
                {formatMoney(doc.expenses.total_expenses)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vyrovnanie zalohy */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Vyrovnanie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Celkove naklady</span>
              <span className="font-mono">
                {formatMoney(doc.reconciliation.total_expenses)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Vyplatena zaloha</span>
              <span className="font-mono">
                {formatMoney(doc.reconciliation.advance_amount)}
              </span>
            </div>
            <Separator />
            <div
              className={`flex justify-between font-bold text-lg ${
                doc.reconciliation.settlement_type === "doplatok"
                  ? "text-red-600 dark:text-red-400"
                  : doc.reconciliation.settlement_type === "vratenie"
                    ? "text-green-600 dark:text-green-400"
                    : ""
              }`}
            >
              <span>{doc.reconciliation.settlement_label.split(":")[0]}</span>
              <span className="font-mono">
                {formatMoney(Math.abs(doc.reconciliation.difference))}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Sposob platby</span>
              <span>
                {doc.payment_method === "cash" ? "Hotovost" : "Bankovy prevod"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Podpisy */}
      <div className="grid grid-cols-3 gap-6 mt-8 pt-4">
        <div className="text-center">
          <div className="border-b border-dashed mb-2 pb-8" />
          <p className="text-xs text-muted-foreground">Zamestnanec</p>
        </div>
        <div className="text-center">
          <div className="border-b border-dashed mb-2 pb-8" />
          <p className="text-xs text-muted-foreground">Schvalil</p>
        </div>
        <div className="text-center">
          <div className="border-b border-dashed mb-2 pb-8" />
          <p className="text-xs text-muted-foreground">Uctovnik</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4">
        Datum vyuctovania: {formatDate(doc.settlement_date)}
      </p>
    </div>
  )
}

// ---- Hlavna stranka ----

export default function TravelDocumentPage() {
  const params = useParams()
  const { toast } = useToast()

  const [orderDoc, setOrderDoc] = useState<TravelOrderDocument | null>(null)
  const [settlementDoc, setSettlementDoc] = useState<TravelSettlementDocument | null>(null)
  const [loadingOrder, setLoadingOrder] = useState(true)
  const [loadingSettlement, setLoadingSettlement] = useState(true)
  const [activeTab, setActiveTab] = useState("order")

  const fetchOrderDoc = useCallback(async () => {
    if (!params.id) return
    setLoadingOrder(true)
    try {
      const res = await fetch(
        `/api/travel-orders/${params.id}/document?type=order`
      )
      if (res.ok) {
        const data = await res.json()
        setOrderDoc(data)
      }
    } catch {
      // Tichy zlyhanie
    } finally {
      setLoadingOrder(false)
    }
  }, [params.id])

  const fetchSettlementDoc = useCallback(async () => {
    if (!params.id) return
    setLoadingSettlement(true)
    try {
      const res = await fetch(
        `/api/travel-orders/${params.id}/document?type=settlement`
      )
      if (res.ok) {
        const data = await res.json()
        setSettlementDoc(data)
      }
    } catch {
      // Tichy zlyhanie - vyuctovanie nemusi existovat
    } finally {
      setLoadingSettlement(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchOrderDoc()
    fetchSettlementDoc()
  }, [fetchOrderDoc, fetchSettlementDoc])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hlavicka (skryta pri tlaci) */}
      <div className="flex items-center gap-4 mb-6 print:hidden">
        <Link href={`/travel/${params.id}/settlement`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Dokumenty cestovneho prikazu
          </h1>
        </div>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="mr-2 h-4 w-4" />
          Tlacit
        </Button>
      </div>

      {/* Taby (skryte pri tlaci) */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="print:hidden mb-6"
      >
        <TabsList>
          <TabsTrigger value="order">Cestovny prikaz</TabsTrigger>
          <TabsTrigger value="settlement" disabled={!settlementDoc}>
            Vyuctovanie
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Obsah */}
      <div className="bg-white dark:bg-background p-8 print:p-4 rounded-lg border print:border-0 print:shadow-none">
        {activeTab === "order" && (
          <>
            {loadingOrder ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : orderDoc ? (
              <TravelOrderView doc={orderDoc} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Cestovny prikaz sa nepodarilo nacitat.</p>
              </div>
            )}
          </>
        )}

        {activeTab === "settlement" && (
          <>
            {loadingSettlement ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : settlementDoc ? (
              <SettlementView doc={settlementDoc} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Vyuctovanie este nebolo vytvorene pre tento cestovny prikaz.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

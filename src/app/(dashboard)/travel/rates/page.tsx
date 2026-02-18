"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft,
  Search,
  Globe,
  Home,
  Car,
  Info,
} from "lucide-react"
import {
  DOMESTIC_MEAL_RATES,
  FOREIGN_PER_DIEM_RATES,
  VEHICLE_RATE_PER_KM,
  MEAL_REDUCTION_PERCENTAGES,
} from "@/lib/travel/travel-calculator"

export default function TravelRatesPage() {
  const [search, setSearch] = useState("")

  const foreignRateEntries = Array.from(Object.entries(FOREIGN_PER_DIEM_RATES))
    .filter(([code, info]) => {
      if (!search) return true
      const s = search.toLowerCase()
      return (
        code.toLowerCase().includes(s) ||
        info.country_sk.toLowerCase().includes(s)
      )
    })
    .sort((a, b) => a[1].country_sk.localeCompare(b[1].country_sk))

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
            Sadzby cestovnych nahrad
          </h1>
          <p className="text-muted-foreground">
            Aktualne sadzby pre tuzemske a zahranicne pracovne cesty
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column – domestic rates */}
        <div className="space-y-6">
          {/* Tuzemske stravne */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Tuzemske stravne
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Podla Opatrenia MPSVR SR c. 171/2024 Z. z. o sumach stravneho
                (ucinne od 1.1.2025)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">
                        Casovy usek
                      </th>
                      <th className="h-10 px-4 text-right font-medium">
                        Sadzba
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-3">
                        {DOMESTIC_MEAL_RATES.tier1.min_hours} az{" "}
                        {DOMESTIC_MEAL_RATES.tier1.max_hours} hodin
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {DOMESTIC_MEAL_RATES.tier1.rate.toFixed(2)} EUR
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">
                        {DOMESTIC_MEAL_RATES.tier2.min_hours} az{" "}
                        {DOMESTIC_MEAL_RATES.tier2.max_hours} hodin
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {DOMESTIC_MEAL_RATES.tier2.rate.toFixed(2)} EUR
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">
                        Nad {DOMESTIC_MEAL_RATES.tier3.min_hours} hodin
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {DOMESTIC_MEAL_RATES.tier3.rate.toFixed(2)} EUR
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Znizenie stravneho */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Znizenie stravneho pri bezplatnom jedle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Ak zamestnavatel alebo iny subjekt poskytne zamestnancovi
                bezplatne jedlo, stravne sa znizuje o nasledujuce percenta:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">
                        Jedlo
                      </th>
                      <th className="h-10 px-4 text-right font-medium">
                        Znizenie
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-3">Ranajky</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {MEAL_REDUCTION_PERCENTAGES.breakfast * 100} %
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">Obed</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {MEAL_REDUCTION_PERCENTAGES.lunch * 100} %
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">Vecera</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {MEAL_REDUCTION_PERCENTAGES.dinner * 100} %
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Nahrada za vozidlo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Nahrada za pouzitie sukromneho vozidla
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Pri pouziti vlastneho motoroveho vozidla na sluzbnu cestu patri
                zamestnancovi nahrada, ktora sa sklada z:
              </p>
              <div className="space-y-3">
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="font-semibold">
                    Zakladna nahrada: {VEHICLE_RATE_PER_KM} EUR / km
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Fixna sadzba za kazdy prejdeny kilometer.
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="font-semibold">
                    Nahrada za spotrebovane pohonne hmoty
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Vypocet: (spotreba / 100) x vzdialenost x cena paliva
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Spotreba sa urcuje podla technického preukazu vozidla.
                    Cena paliva podla dokladu o tankovani alebo podla
                    statistickej priemernej ceny.
                  </p>
                </div>
                <div className="p-3 border rounded-md">
                  <p className="font-semibold">Celkovy vzorec:</p>
                  <p className="font-mono text-sm mt-1">
                    nahrada = (sadzba_km x km) + (spotreba/100 x km x
                    cena_paliva)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column – foreign rates */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Zahranicne diéty – denne sadzby
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Podla Opatrenia MF SR o sumach stravneho pri zahranicnych
                pracovnych cestach. Vreckove moze byt do 40 % z dennej sadzby.
              </p>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Hladat krajinu..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b bg-muted/50">
                      <th className="h-9 px-3 text-left font-medium">Kod</th>
                      <th className="h-9 px-3 text-left font-medium">
                        Krajina
                      </th>
                      <th className="h-9 px-3 text-right font-medium">
                        Sadzba
                      </th>
                      <th className="h-9 px-3 text-center font-medium">
                        Mena
                      </th>
                      <th className="h-9 px-3 text-right font-medium">
                        Vreckove 40%
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {foreignRateEntries.map(([code, info]) => (
                      <tr key={code} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs">{code}</td>
                        <td className="px-3 py-2">{info.country_sk}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {info.rate.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                            {info.currency}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {(info.rate * 0.4).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {foreignRateEntries.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="h-16 text-center text-muted-foreground"
                        >
                          Ziadne vysledky pre vyhladavanie
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-3 border rounded-md flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">
                    Znizenie zahranicnych diet:
                  </p>
                  <p>
                    Rovnake percentualne znizenie ako pri tuzemskych cestach:
                    ranajky 25 %, obed 40 %, vecera 35 %. Znizenie sa pocita
                    z celkovej dennej sadzby.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface ExchangeRate {
  id: string
  currency_from: string
  currency_to: string
  rate: number
  date: string
  source: string
}

const currencyCountries: Record<string, string> = {
  USD: "USA",
  GBP: "Velka Britania",
  CZK: "Cesko",
  HUF: "Madarsko",
  PLN: "Polsko",
  CHF: "Svajciarsko",
  SEK: "Svedsko",
  NOK: "Norsko",
  DKK: "Dansko",
  RON: "Rumunsko",
  BGN: "Bulharsko",
  HRK: "Chorvatsko",
  JPY: "Japonsko",
}

const commonCurrencies = Object.keys(currencyCountries)

export default function ExchangeRatesPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [selectedCurrency, setSelectedCurrency] = useState<string>("")
  const [manualRate, setManualRate] = useState({
    currency_to: "USD",
    rate: "",
    date: new Date().toISOString().split("T")[0],
  })

  const fetchRates = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      let url = `/api/settings/exchange-rates?company_id=${activeCompanyId}`
      if (selectedDate) url += `&date=${selectedDate}`
      if (selectedCurrency) url += `&currency=${selectedCurrency}`

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setRates(data)
      }
    } catch {
      toast({ title: "Chyba pri nacitani kurzov", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedDate, selectedCurrency, toast])

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  const handleFetchEcb = async () => {
    if (!activeCompanyId) return
    setFetching(true)
    try {
      const res = await fetch(
        `/api/settings/exchange-rates?company_id=${activeCompanyId}&action=fetch`
      )
      if (res.ok) {
        toast({ title: "Kurzy ECB boli aktualizovane" })
        fetchRates()
      } else {
        toast({ title: "Chyba pri aktualizacii kurzov", variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri aktualizacii kurzov", variant: "destructive" })
    } finally {
      setFetching(false)
    }
  }

  const handleManualRate = async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch("/api/settings/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          currency_from: "EUR",
          currency_to: manualRate.currency_to,
          rate: parseFloat(manualRate.rate),
          date: manualRate.date,
        }),
      })
      if (res.ok) {
        toast({ title: "Kurz bol ulozeny" })
        setDialogOpen(false)
        setManualRate({
          currency_to: "USD",
          rate: "",
          date: new Date().toISOString().split("T")[0],
        })
        fetchRates()
      } else {
        const err = await res.json()
        toast({ title: "Chyba", description: err.error?.toString(), variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri ukladani kurzu", variant: "destructive" })
    }
  }

  // Group rates by currency and get latest for histogram
  const latestByCurrency: Record<string, ExchangeRate> = {}
  for (const rate of rates) {
    const key = rate.currency_to
    if (!latestByCurrency[key] || rate.date > latestByCurrency[key].date) {
      latestByCurrency[key] = rate
    }
  }

  const displayRates = Object.values(latestByCurrency).sort((a, b) =>
    a.currency_to.localeCompare(b.currency_to)
  )

  // Find max rate for chart scaling
  const maxRate = Math.max(...displayRates.map((r) => r.rate), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kurzovy listok</h1>
          <p className="text-muted-foreground">
            Kurzy ECB a manualne zadane kurzy
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Manualny kurz</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pridat manualny kurz</DialogTitle>
                <DialogDescription>
                  Zadajte kurz manualne pre vybranu menu
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-currency">Mena</Label>
                  <Select
                    value={manualRate.currency_to}
                    onValueChange={(v) =>
                      setManualRate((prev) => ({ ...prev, currency_to: v }))
                    }
                  >
                    <SelectTrigger id="manual-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {commonCurrencies.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c} - {currencyCountries[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-rate">Kurz (1 EUR = X)</Label>
                  <Input
                    id="manual-rate"
                    type="number"
                    step="0.0001"
                    value={manualRate.rate}
                    onChange={(e) =>
                      setManualRate((prev) => ({ ...prev, rate: e.target.value }))
                    }
                    placeholder="1.0842"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-date">Datum</Label>
                  <Input
                    id="manual-date"
                    type="date"
                    value={manualRate.date}
                    onChange={(e) =>
                      setManualRate((prev) => ({ ...prev, date: e.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Zrusit
                </Button>
                <Button
                  onClick={handleManualRate}
                  disabled={!manualRate.rate}
                >
                  Ulozit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleFetchEcb} disabled={fetching}>
            {fetching ? "Aktualizujem..." : "Aktualizovat kurzy"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="space-y-2">
              <Label htmlFor="filter-date">Datum</Label>
              <Input
                id="filter-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[200px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-currency">Mena</Label>
              <Select
                value={selectedCurrency}
                onValueChange={setSelectedCurrency}
              >
                <SelectTrigger id="filter-currency" className="w-[200px]">
                  <SelectValue placeholder="Vsetky meny" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsetky meny</SelectItem>
                  {commonCurrencies.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rates table */}
      <Card>
        <CardHeader>
          <CardTitle>Kurzy</CardTitle>
          <CardDescription>Prehlad kurzov voci EUR</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">Nacitavam...</p>
          ) : displayRates.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Ziadne kurzy. Kliknite na &quot;Aktualizovat kurzy&quot; pre stiahnutie kurzov ECB.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mena</TableHead>
                  <TableHead>Krajina</TableHead>
                  <TableHead>Kurz (1 EUR = X)</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Zdroj</TableHead>
                  <TableHead>Graf</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRates.map((r) => {
                  const barWidth = Math.min((r.rate / maxRate) * 100, 100)
                  return (
                    <TableRow key={r.id || `${r.currency_to}-${r.date}`}>
                      <TableCell className="font-medium">{r.currency_to}</TableCell>
                      <TableCell>
                        {currencyCountries[r.currency_to] || r.currency_to}
                      </TableCell>
                      <TableCell className="font-mono">
                        {r.rate.toFixed(4)}
                      </TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>
                        <Badge
                          variant={r.source === "ECB" ? "default" : "outline"}
                        >
                          {r.source === "ECB" ? "ECB" : "Manualne"}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[200px]">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-full rounded bg-muted">
                            <div
                              className="h-full rounded bg-primary/60"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

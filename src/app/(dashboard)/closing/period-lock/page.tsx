"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Lock,
  Unlock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Shield,
} from "lucide-react"

interface PeriodLock {
  id: string
  period_start: string
  period_end: string
  locked: boolean
  locked_at: string | null
  locked_by: string | null
  created_at: string
}

interface Period {
  month: number
  year: number
  label: string
  periodStart: string
  periodEnd: string
  locked: boolean
  lockId: string | null
  lockedAt: string | null
}

const monthNames = [
  "Januar", "Februar", "Marec", "April", "Maj", "Jun",
  "Jul", "August", "September", "Oktober", "November", "December",
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function PeriodLockPage() {
  const { activeCompanyId, isAdmin } = useCompany()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [periodLocks, setPeriodLocks] = useState<PeriodLock[]>([])
  const [togglingPeriod, setTogglingPeriod] = useState<string | null>(null)
  const [confirmUnlock, setConfirmUnlock] = useState<string | null>(null)

  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const fetchPeriodLocks = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/closing/period-lock?company_id=${activeCompanyId}&fiscal_year=${selectedYear}`
      )
      const json = await res.json()
      if (res.ok) {
        setPeriodLocks(json.data || [])
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa nacitat uzamknutia" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat uzamknutia" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedYear, toast])

  useEffect(() => {
    fetchPeriodLocks()
  }, [fetchPeriodLocks])

  // Build periods for the selected year
  const periods: Period[] = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const monthStr = String(month).padStart(2, "0")
    const lastDay = new Date(selectedYear, month, 0).getDate()
    const periodStart = `${selectedYear}-${monthStr}-01`
    const periodEnd = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`

    const lock = periodLocks.find(
      (l) => l.period_start === periodStart && l.period_end === periodEnd
    )

    return {
      month,
      year: selectedYear,
      label: `${monthNames[i]} ${selectedYear}`,
      periodStart,
      periodEnd,
      locked: lock?.locked || false,
      lockId: lock?.id || null,
      lockedAt: lock?.locked_at || null,
    }
  })

  const lockedCount = periods.filter((p) => p.locked).length

  const togglePeriodLock = async (period: Period) => {
    if (!activeCompanyId) return

    // If unlocking, show confirmation
    if (period.locked) {
      if (confirmUnlock !== `${period.periodStart}-${period.periodEnd}`) {
        setConfirmUnlock(`${period.periodStart}-${period.periodEnd}`)
        return
      }

      // Unlocking - use DELETE endpoint (admin only)
      setTogglingPeriod(`${period.periodStart}-${period.periodEnd}`)
      setConfirmUnlock(null)
      try {
        const params = new URLSearchParams({
          company_id: activeCompanyId,
          period_start: period.periodStart,
          period_end: period.periodEnd,
        })
        const res = await fetch(`/api/closing/period-lock?${params}`, {
          method: "DELETE",
        })
        const json = await res.json()

        if (res.ok) {
          toast({ title: "Obdobie odomknute", description: `${period.label} bolo odomknute` })
          fetchPeriodLocks()
        } else {
          toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa odomknut obdobie" })
        }
      } catch {
        toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odomknut obdobie" })
      } finally {
        setTogglingPeriod(null)
      }
    } else {
      // Locking - use POST endpoint
      setTogglingPeriod(`${period.periodStart}-${period.periodEnd}`)
      try {
        const res = await fetch("/api/closing/period-lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: activeCompanyId,
            period_start: period.periodStart,
            period_end: period.periodEnd,
            locked: true,
          }),
        })
        const json = await res.json()

        if (res.ok) {
          toast({ title: "Obdobie uzamknute", description: `${period.label} bolo uzamknute` })
          fetchPeriodLocks()
        } else {
          toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa uzamknut obdobie" })
        }
      } catch {
        toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa uzamknut obdobie" })
      } finally {
        setTogglingPeriod(null)
      }
    }
  }

  const lockAllPeriods = async () => {
    if (!activeCompanyId) return
    if (!confirm(`Naozaj chcete uzamknut vsetky obdobia v roku ${selectedYear}?`)) return

    for (const period of periods) {
      if (!period.locked) {
        setTogglingPeriod(`${period.periodStart}-${period.periodEnd}`)
        try {
          await fetch("/api/closing/period-lock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              company_id: activeCompanyId,
              period_start: period.periodStart,
              period_end: period.periodEnd,
              locked: true,
            }),
          })
        } catch {
          // Continue with next period
        }
      }
    }
    setTogglingPeriod(null)
    fetchPeriodLocks()
    toast({ title: "Hotovo", description: `Vsetky obdobia v roku ${selectedYear} boli uzamknute` })
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Uzamknutie obdobia</h1>
          <p className="text-muted-foreground">
            Sprava uzamknutia uctovnych obdobi proti nezelanych zmenam
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={lockAllPeriods}
            disabled={loading || lockedCount === 12}
          >
            <Lock className="mr-2 h-4 w-4" />
            Uzamknut vsetky
          </Button>
        </div>
      </div>

      {/* Year selector */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Fiskalny rok</label>
              <select
                className="flex h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4 ml-auto">
              <div className="flex items-center gap-2 text-sm">
                <Lock className="h-4 w-4 text-green-600" />
                <span>{lockedCount} uzamknutych</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Unlock className="h-4 w-4 text-gray-400" />
                <span>{12 - lockedCount} odomknutych</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Obdobia v roku {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Obdobie</th>
                  <th className="h-10 px-4 text-left font-medium">Zaciatok</th>
                  <th className="h-10 px-4 text-left font-medium">Koniec</th>
                  <th className="h-10 px-4 text-center font-medium">Stav</th>
                  <th className="h-10 px-4 text-left font-medium">Uzamknute</th>
                  <th className="h-10 px-4 text-right font-medium">Akcia</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Nacitavam...
                    </td>
                  </tr>
                ) : (
                  periods.map((period) => {
                    const periodKey = `${period.periodStart}-${period.periodEnd}`
                    const isToggling = togglingPeriod === periodKey
                    const isConfirming = confirmUnlock === periodKey

                    return (
                      <tr key={periodKey} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            {period.locked ? (
                              <Lock className="h-4 w-4 text-green-600" />
                            ) : (
                              <Unlock className="h-4 w-4 text-gray-400" />
                            )}
                            {period.label}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                          {formatDate(period.periodStart)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                          {formatDate(period.periodEnd)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {period.locked ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                              <Shield className="h-3 w-3" />
                              Uzamknute
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              Otvorene
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {period.lockedAt ? formatDateTime(period.lockedAt) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isToggling ? (
                            <Loader2 className="h-4 w-4 animate-spin ml-auto" />
                          ) : isConfirming ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs text-yellow-600 mr-2">Potvrdit odomknutie?</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-destructive"
                                onClick={() => togglePeriodLock(period)}
                              >
                                Ano
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setConfirmUnlock(null)}
                              >
                                Nie
                              </Button>
                            </div>
                          ) : period.locked ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950"
                              onClick={() => togglePeriodLock(period)}
                              disabled={!isAdmin()}
                              title={!isAdmin() ? "Odomknutie je povolene iba pre administratorov" : "Odomknut obdobie"}
                            >
                              <Unlock className="h-4 w-4 mr-1" />
                              Odomknut
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                              onClick={() => togglePeriodLock(period)}
                            >
                              <Lock className="h-4 w-4 mr-1" />
                              Uzamknut
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Informacie o uzamknuti obdobia</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>- Uzamknute obdobie zabraнuje vytvaraniu, uprave a mazaniu uctovnych zapisov v danom obdobi.</li>
                <li>- Odomknutie je mozne iba pre pouzivatelov s rolou administora.</li>
                <li>- Pre uzavierku odporucame uzamknut vsetky obdobia daneho fiskalneho roka.</li>
                <li>- Uzamknutie neovplyvnuje moznost prezerania udajov a reportov.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

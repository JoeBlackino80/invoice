"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  AlertTriangle,
  Calendar,
} from "lucide-react"

interface AgingBucket {
  key: string
  label: string
  count: number
  total_amount: number
  percentage: number
}

interface AgingSummary {
  total_outstanding: number
  total_invoices: number
  average_days_overdue: number
  dpo: number
}

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

export default function AgingPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [type, setType] = useState<"receivables" | "payables">("receivables")
  const [buckets, setBuckets] = useState<AgingBucket[]>([])
  const [summary, setSummary] = useState<AgingSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAging = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        type,
      })

      const res = await fetch(`/api/subledger/aging?${params}`)
      const json = await res.json()

      if (res.ok) {
        setBuckets(json.buckets || [])
        setSummary(json.summary || null)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa načítať aging analýzu" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať aging analýzu" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, type, toast])

  useEffect(() => {
    fetchAging()
  }, [fetchAging])

  const maxAmount = Math.max(...buckets.map((b) => b.total_amount), 1)

  const bucketColors: Record<string, { bg: string; bar: string }> = {
    current: { bg: "bg-green-50 dark:bg-green-950", bar: "bg-green-500" },
    "1_30": { bg: "bg-yellow-50 dark:bg-yellow-950", bar: "bg-yellow-500" },
    "31_60": { bg: "bg-orange-50 dark:bg-orange-950", bar: "bg-orange-500" },
    "61_90": { bg: "bg-red-50 dark:bg-red-950", bar: "bg-red-400" },
    "91_180": { bg: "bg-red-100 dark:bg-red-900", bar: "bg-red-500" },
    "180_plus": { bg: "bg-red-200 dark:bg-red-800", bar: "bg-red-600" },
  }

  return (
    <div>
      <Breadcrumb />

      <div className="mb-4">
        <Link
          href="/accounting/subledger"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Späť na prehľad saldokonta
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Aging analýza</h1>
          <p className="text-muted-foreground">Rozdelenie nesplatených položiek podľa doby po splatnosti</p>
        </div>
        <Clock className="h-8 w-8 text-orange-500" />
      </div>

      {/* Type toggle */}
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant={type === "receivables" ? "default" : "outline"}
          onClick={() => setType("receivables")}
        >
          Pohľadávky
        </Button>
        <Button
          variant={type === "payables" ? "default" : "outline"}
          onClick={() => setType("payables")}
        >
          Záväzky
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Načítavam...</div>
      ) : (
        <>
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {type === "receivables" ? "Celkové pohľadávky" : "Celkové záväzky"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold font-mono">{formatMoney(summary.total_outstanding)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{summary.total_invoices} faktúr</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Priemerné dni po splatnosti
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {summary.average_days_overdue}
                    <span className="text-sm font-normal text-muted-foreground ml-1">dní</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {type === "receivables" ? "DRO" : "DPO"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {summary.dpo}
                    <span className="text-sm font-normal text-muted-foreground ml-1">dní</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {type === "receivables" ? "Days Receivable Outstanding" : "Days Payable Outstanding"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Celkový počet faktúr
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{summary.total_invoices}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Visual aging bars */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">
                Rozdelenie podľa splatnosti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {buckets.map((bucket) => {
                  const colors = bucketColors[bucket.key] || { bg: "bg-gray-50", bar: "bg-gray-500" }
                  const barWidth = maxAmount > 0 ? (bucket.total_amount / maxAmount) * 100 : 0

                  return (
                    <div key={bucket.key} className={`rounded-lg p-4 ${colors.bg}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{bucket.label}</span>
                          <span className="text-sm text-muted-foreground">
                            ({bucket.count} {bucket.count === 1 ? "faktúra" : bucket.count < 5 ? "faktúry" : "faktúr"})
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{bucket.percentage}%</span>
                          <span className="font-mono font-bold">{formatMoney(bucket.total_amount)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-6 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                          style={{
                            width: `${barWidth}%`,
                            minWidth: bucket.total_amount > 0 ? "8px" : "0",
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Summary table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sumarizácia</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Kategória</th>
                      <th className="h-10 px-4 text-center font-medium">Počet</th>
                      <th className="h-10 px-4 text-right font-medium">Suma</th>
                      <th className="h-10 px-4 text-right font-medium">% z celku</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map((bucket) => (
                      <tr key={bucket.key} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{bucket.label}</td>
                        <td className="px-4 py-3 text-center">{bucket.count}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatMoney(bucket.total_amount)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium">{bucket.percentage}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/50 font-medium">
                      <td className="px-4 py-3">Spolu</td>
                      <td className="px-4 py-3 text-center">
                        {summary?.total_invoices || 0}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatMoney(summary?.total_outstanding || 0)}
                      </td>
                      <td className="px-4 py-3 text-right">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Stats footer */}
          {summary && (
            <div className="mt-6 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  Celkový dlh: <strong className="text-foreground">{formatMoney(summary.total_outstanding)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>
                  Priemerné dni po splatnosti: <strong className="text-foreground">{summary.average_days_overdue} dní</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {type === "receivables" ? "DRO" : "DPO"}: <strong className="text-foreground">{summary.dpo} dní</strong>
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

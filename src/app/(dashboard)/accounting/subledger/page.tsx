"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
} from "lucide-react"

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

interface ReceivablesSummary {
  total_receivable: number
  total_overdue: number
  total_contacts: number
  total_invoices: number
}

interface PayablesSummary {
  total_payable: number
  total_overdue: number
  total_contacts: number
  total_invoices: number
}

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

export default function SubledgerOverviewPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [receivablesSummary, setReceivablesSummary] = useState<ReceivablesSummary | null>(null)
  const [payablesSummary, setPayablesSummary] = useState<PayablesSummary | null>(null)
  const [receivablesAging, setReceivablesAging] = useState<{ buckets: AgingBucket[]; summary: AgingSummary } | null>(null)
  const [payablesAging, setPayablesAging] = useState<{ buckets: AgingBucket[]; summary: AgingSummary } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const [recRes, payRes, recAgingRes, payAgingRes] = await Promise.all([
        fetch(`/api/subledger/receivables?company_id=${activeCompanyId}`),
        fetch(`/api/subledger/payables?company_id=${activeCompanyId}`),
        fetch(`/api/subledger/aging?company_id=${activeCompanyId}&type=receivables`),
        fetch(`/api/subledger/aging?company_id=${activeCompanyId}&type=payables`),
      ])

      if (recRes.ok) {
        const recJson = await recRes.json()
        setReceivablesSummary(recJson.summary)
      }
      if (payRes.ok) {
        const payJson = await payRes.json()
        setPayablesSummary(payJson.summary)
      }
      if (recAgingRes.ok) {
        const recAgingJson = await recAgingRes.json()
        setReceivablesAging({ buckets: recAgingJson.buckets, summary: recAgingJson.summary })
      }
      if (payAgingRes.ok) {
        const payAgingJson = await payAgingRes.json()
        setPayablesAging({ buckets: payAgingJson.buckets, summary: payAgingJson.summary })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať údaje saldokonta" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const maxBucketAmount = Math.max(
    ...(receivablesAging?.buckets || []).map((b) => b.total_amount),
    ...(payablesAging?.buckets || []).map((b) => b.total_amount),
    1
  )

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Saldokonto</h1>
        <p className="text-muted-foreground">Prehľad pohľadávok, záväzkov a analýza splatnosti</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Načítavam...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Receivables Card */}
            <Link href="/accounting/subledger/receivables">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg">Pohľadávky</CardTitle>
                    <CardDescription>Odberateľské saldokonto</CardDescription>
                  </div>
                  <ArrowUpRight className="h-8 w-8 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-3xl font-bold font-mono">
                        {formatMoney(receivablesSummary?.total_receivable || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Celkové pohľadávky</p>
                    </div>
                    <div className="flex justify-between text-sm">
                      <div>
                        <span className="text-destructive font-medium">
                          {formatMoney(receivablesSummary?.total_overdue || 0)}
                        </span>
                        <span className="text-muted-foreground ml-1">po splatnosti</span>
                      </div>
                      <div className="text-muted-foreground">
                        {receivablesSummary?.total_invoices || 0} faktúr
                        {" / "}
                        {receivablesSummary?.total_contacts || 0} kontaktov
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-primary">
                      Zobraziť detail
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Payables Card */}
            <Link href="/accounting/subledger/payables">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg">Záväzky</CardTitle>
                    <CardDescription>Dodávateľské saldokonto</CardDescription>
                  </div>
                  <ArrowDownLeft className="h-8 w-8 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-3xl font-bold font-mono">
                        {formatMoney(payablesSummary?.total_payable || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Celkové záväzky</p>
                    </div>
                    <div className="flex justify-between text-sm">
                      <div>
                        <span className="text-destructive font-medium">
                          {formatMoney(payablesSummary?.total_overdue || 0)}
                        </span>
                        <span className="text-muted-foreground ml-1">po splatnosti</span>
                      </div>
                      <div className="text-muted-foreground">
                        {payablesSummary?.total_invoices || 0} faktúr
                        {" / "}
                        {payablesSummary?.total_contacts || 0} kontaktov
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-primary">
                      Zobraziť detail
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Aging Overview */}
          <Link href="/accounting/subledger/aging">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">Aging analýza</CardTitle>
                  <CardDescription>Rozdelenie pohľadávok a záväzkov podľa splatnosti</CardDescription>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Receivables aging */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Pohľadávky</h4>
                    <div className="space-y-2">
                      {(receivablesAging?.buckets || []).map((bucket) => (
                        <div key={bucket.key} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">{bucket.label}</span>
                          <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                bucket.key === "current"
                                  ? "bg-green-500"
                                  : bucket.key === "1_30"
                                  ? "bg-yellow-500"
                                  : bucket.key === "31_60"
                                  ? "bg-orange-500"
                                  : "bg-red-500"
                              }`}
                              style={{
                                width: `${maxBucketAmount > 0 ? (bucket.total_amount / maxBucketAmount) * 100 : 0}%`,
                                minWidth: bucket.total_amount > 0 ? "4px" : "0",
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono w-24 text-right shrink-0">
                            {formatMoney(bucket.total_amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {receivablesAging?.summary && (
                      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                        <span>DRO: {receivablesAging.summary.dpo} dní</span>
                        <span>Priem. oneskorenie: {receivablesAging.summary.average_days_overdue} dní</span>
                      </div>
                    )}
                  </div>

                  {/* Payables aging */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Záväzky</h4>
                    <div className="space-y-2">
                      {(payablesAging?.buckets || []).map((bucket) => (
                        <div key={bucket.key} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">{bucket.label}</span>
                          <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                bucket.key === "current"
                                  ? "bg-green-500"
                                  : bucket.key === "1_30"
                                  ? "bg-yellow-500"
                                  : bucket.key === "31_60"
                                  ? "bg-orange-500"
                                  : "bg-red-500"
                              }`}
                              style={{
                                width: `${maxBucketAmount > 0 ? (bucket.total_amount / maxBucketAmount) * 100 : 0}%`,
                                minWidth: bucket.total_amount > 0 ? "4px" : "0",
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono w-24 text-right shrink-0">
                            {formatMoney(bucket.total_amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {payablesAging?.summary && (
                      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                        <span>DPO: {payablesAging.summary.dpo} dní</span>
                        <span>Priem. oneskorenie: {payablesAging.summary.average_days_overdue} dní</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center text-sm text-primary mt-4">
                  Zobraziť podrobnú analýzu
                  <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </>
      )}
    </div>
  )
}

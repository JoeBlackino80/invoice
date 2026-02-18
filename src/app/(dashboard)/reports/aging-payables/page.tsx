"use client"

import { useCompany } from "@/hooks/use-company"
import { useEffect, useState, useCallback } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { Download, ArrowUpDown } from "lucide-react"
import type { AgingReport } from "@/lib/reports/financial-reports"

const bucketColors: Record<string, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  darkred: "bg-red-800",
}

const bucketBadgeColors: Record<string, string> = {
  "0-30 dni": "bg-green-100 text-green-800",
  "31-60 dni": "bg-yellow-100 text-yellow-800",
  "61-90 dni": "bg-orange-100 text-orange-800",
  "91-180 dni": "bg-red-100 text-red-800",
  "180+ dni": "bg-red-200 text-red-900",
}

type SortField = "days_overdue" | "outstanding"
type SortDir = "asc" | "desc"

export default function AgingPayablesPage() {
  const { activeCompanyId, isLoading: companyLoading } = useCompany()
  const [report, setReport] = useState<AgingReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [sortField, setSortField] = useState<SortField>("days_overdue")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const fetchReport = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)

    const params = new URLSearchParams({
      company_id: activeCompanyId,
      type: "payables",
      as_of_date: asOfDate,
    })
    const res = await fetch(`/api/reports/aging?${params}`)
    if (res.ok) {
      const json = await res.json()
      setReport(json)
    }
    setLoading(false)
  }, [activeCompanyId, asOfDate])

  useEffect(() => {
    if (!companyLoading && activeCompanyId) {
      fetchReport()
    }
  }, [companyLoading, activeCompanyId, fetchReport])

  const allInvoices = report
    ? report.buckets.flatMap((b) => b.invoices)
    : []

  const sortedInvoices = [...allInvoices].sort((a, b) => {
    const mult = sortDir === "asc" ? 1 : -1
    if (sortField === "days_overdue") return (a.days_overdue - b.days_overdue) * mult
    return (a.outstanding - b.outstanding) * mult
  })

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const formatEur = (v: number) =>
    v.toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR"

  const exportCsv = () => {
    if (!sortedInvoices.length) return
    const header = "Kontakt;Cislo faktury;Datum vystavenia;Splatnost;Suma;Uhradene;Zostatok;Dni po splatnosti;Kategoria\n"
    const rows = sortedInvoices
      .map(
        (inv) =>
          `${inv.contact_name};${inv.invoice_number};${inv.issue_date};${inv.due_date};${inv.amount};${inv.paid_amount};${inv.outstanding};${inv.days_overdue};${inv.bucket}`
      )
      .join("\n")

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `aging-zavazkov-${asOfDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (companyLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Nacitavam...</p>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Aging zavazkov
          </h1>
          <p className="text-muted-foreground">
            Analyza neuhradanych prijatych faktur podla doby po splatnosti
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!sortedInvoices.length}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Date selector */}
      <div className="flex items-end gap-4 mb-6">
        <div>
          <Label>Datum (ku dnu)</Label>
          <Input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="w-48"
          />
        </div>
        <Button onClick={fetchReport} disabled={loading}>
          {loading ? "Nacitavam..." : "Zobrazit"}
        </Button>
      </div>

      {report && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-5 mb-6">
            {report.buckets.map((bucket) => (
              <Card key={bucket.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${bucketColors[bucket.color]}`}
                    />
                    {bucket.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatEur(bucket.total)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {bucket.count} {bucket.count === 1 ? "faktura" : bucket.count < 5 ? "faktury" : "faktur"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Distribution bar */}
          {report.total_outstanding > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Rozdelenie zavazkov - celkovo {formatEur(report.total_outstanding)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-8 rounded-lg overflow-hidden">
                  {report.buckets.map((bucket) => {
                    const pct =
                      report.total_outstanding > 0
                        ? (bucket.total / report.total_outstanding) * 100
                        : 0
                    if (pct === 0) return null
                    return (
                      <div
                        key={bucket.label}
                        className={`${bucketColors[bucket.color]} flex items-center justify-center text-white text-xs font-medium`}
                        style={{ width: `${pct}%` }}
                        title={`${bucket.label}: ${formatEur(bucket.total)} (${pct.toFixed(1)}%)`}
                      >
                        {pct > 8 ? `${pct.toFixed(0)}%` : ""}
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-4 mt-3 flex-wrap">
                  {report.buckets.map((bucket) => (
                    <div key={bucket.label} className="flex items-center gap-1.5 text-xs">
                      <div className={`w-2.5 h-2.5 rounded-full ${bucketColors[bucket.color]}`} />
                      <span>{bucket.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detail table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Detail faktur ({report.total_count})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedInvoices.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Ziadne neuhradene faktury
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kontakt</TableHead>
                      <TableHead>C. faktury</TableHead>
                      <TableHead>Datum vystavenia</TableHead>
                      <TableHead>Splatnost</TableHead>
                      <TableHead className="text-right">Suma</TableHead>
                      <TableHead className="text-right">Zostatok</TableHead>
                      <TableHead>
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => toggleSort("days_overdue")}
                        >
                          Dni po splatnosti
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead>Kategoria</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {inv.contact_name}
                        </TableCell>
                        <TableCell>{inv.invoice_number}</TableCell>
                        <TableCell>{inv.issue_date}</TableCell>
                        <TableCell>{inv.due_date}</TableCell>
                        <TableCell className="text-right">
                          {formatEur(inv.amount)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatEur(inv.outstanding)}
                        </TableCell>
                        <TableCell>{inv.days_overdue}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              bucketBadgeColors[inv.bucket] || ""
                            }
                            variant="outline"
                          >
                            {inv.bucket}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-bold">
                        Spolu
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatEur(
                          sortedInvoices.reduce((s, i) => s + i.amount, 0)
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatEur(report.total_outstanding)}
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

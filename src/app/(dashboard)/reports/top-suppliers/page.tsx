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
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { Truck } from "lucide-react"
import type { TopContact } from "@/lib/reports/financial-reports"

const disciplineColors: Record<string, string> = {
  green: "bg-green-100 text-green-800",
  blue: "bg-blue-100 text-blue-800",
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-gray-100 text-gray-600",
}

export default function TopSuppliersPage() {
  const { activeCompanyId, isLoading: companyLoading } = useCompany()
  const [contacts, setContacts] = useState<TopContact[]>([])
  const [summary, setSummary] = useState<{
    total_amount: number
    active_count: number
    year: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState(String(new Date().getFullYear()))

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

  const fetchData = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)

    const params = new URLSearchParams({
      company_id: activeCompanyId,
      type: "suppliers",
      year,
      limit: "10",
    })
    const res = await fetch(`/api/reports/top-contacts?${params}`)
    if (res.ok) {
      const json = await res.json()
      setContacts(json.contacts || [])
      setSummary(json.summary || null)
    }

    setLoading(false)
  }, [activeCompanyId, year])

  useEffect(() => {
    if (!companyLoading && activeCompanyId) {
      fetchData()
    }
  }, [companyLoading, activeCompanyId, fetchData])

  const formatEur = (v: number) =>
    v.toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR"

  const maxAmount = contacts.length > 0 ? contacts[0].total_amount : 1

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
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Top dodavatelia</h1>
        <p className="text-muted-foreground">
          Najvyznamnejsi dodavatelia podla objemu nakupov
        </p>
      </div>

      {/* Year selector */}
      <div className="flex items-end gap-4 mb-6">
        <div>
          <Label>Rok</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading ? "Nacitavam..." : "Zobrazit"}
        </Button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Celkovy objem nakupov
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatEur(summary.total_amount)}
              </div>
              <p className="text-xs text-muted-foreground">
                Za rok {summary.year}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Aktivni dodavatelia
              </CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.active_count}</div>
              <p className="text-xs text-muted-foreground">
                S aspon jednou fakturou
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bar chart */}
      {contacts.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Top 10 podla objemu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contacts.map((c) => (
                <div key={c.contact_id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium truncate max-w-[200px]">
                      {c.rank}. {c.contact_name}
                    </span>
                    <span>{formatEur(c.total_amount)}</span>
                  </div>
                  <div className="h-4 w-full bg-muted rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-sm"
                      style={{
                        width: `${(c.total_amount / maxAmount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Detail</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Ziadne data pre zvoleny rok
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Dodavatel</TableHead>
                  <TableHead className="text-right">Objem</TableHead>
                  <TableHead className="text-right">Pocet faktur</TableHead>
                  <TableHead className="text-right">
                    Priemerna splatnost (dni)
                  </TableHead>
                  <TableHead>Platobna moralka</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.contact_id}>
                    <TableCell>{c.rank}</TableCell>
                    <TableCell className="font-medium">
                      {c.contact_name}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatEur(c.total_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.invoice_count}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.avg_days_to_pay !== null ? c.avg_days_to_pay : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          disciplineColors[c.payment_discipline_color] || ""
                        }
                        variant="outline"
                      >
                        {c.payment_discipline}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

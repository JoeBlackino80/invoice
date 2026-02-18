"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Download,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Shield,
  Clock,
  Search,
  ChevronLeft,
} from "lucide-react"

// ============================================================================
// Types
// ============================================================================

interface AuditEntry {
  id: string
  company_id: string
  user_id: string
  user_email: string
  action: string
  entity_type: string
  entity_id: string
  old_values: Record<string, any> | null
  new_values: Record<string, any> | null
  ip_address: string | null
  user_agent: string | null
  timestamp: string
}

interface SuspiciousActivity {
  type: string
  description: string
  severity: string
  detected_at: string
  details: Record<string, any>
}

// ============================================================================
// Constants
// ============================================================================

const actionLabels: Record<string, string> = {
  create: "Vytvorenie",
  update: "Zmena",
  delete: "Vymazanie",
  login: "Prihlasenie",
  logout: "Odhlasenie",
  export: "Export",
  approve: "Schvalenie",
  post: "Zauctovanie",
  reverse: "Stornovanie",
}

const actionColors: Record<string, string> = {
  create: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  update: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  delete: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  login: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  logout: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  export: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  approve: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  post: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  reverse: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
}

const entityTypeLabels: Record<string, string> = {
  invoices: "Faktury",
  journal_entries: "Uctovne zapisy",
  contacts: "Kontakty",
  employees: "Zamestnanci",
  bank_transactions: "Bankove transakcie",
  bank_accounts: "Bankove ucty",
  cash_transactions: "Pokladnicne doklady",
  cash_registers: "Pokladne",
  documents: "Dokumenty",
  chart_of_accounts: "Uctovy rozvrh",
  payroll_runs: "Mzdove uzavierky",
  payment_orders: "Platobne prikazy",
  quotes: "Ponuky",
  orders: "Objednavky",
  companies: "Spolocnosti",
  settings: "Nastavenia",
  fiscal_years: "Fiskalne roky",
  assets: "Majetok",
  archive: "Archiv",
  gdpr: "GDPR",
  users: "Pouzivatelia",
  recurring_invoices: "Opakujuce sa faktury",
}

const entityTypeOptions = [
  { value: "all", label: "Vsetky entity" },
  { value: "invoices", label: "Faktury" },
  { value: "journal_entries", label: "Uctovne zapisy" },
  { value: "contacts", label: "Kontakty" },
  { value: "employees", label: "Zamestnanci" },
  { value: "bank_transactions", label: "Bankove transakcie" },
  { value: "documents", label: "Dokumenty" },
  { value: "settings", label: "Nastavenia" },
]

const actionOptions = [
  { value: "all", label: "Vsetky akcie" },
  { value: "create", label: "Vytvorenie" },
  { value: "update", label: "Zmena" },
  { value: "delete", label: "Vymazanie" },
  { value: "login", label: "Prihlasenie" },
  { value: "export", label: "Export" },
  { value: "approve", label: "Schvalenie" },
  { value: "post", label: "Zauctovanie" },
]

// ============================================================================
// Component
// ============================================================================

export default function AuditLogPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [suspicious, setSuspicious] = useState<SuspiciousActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })

  // Filtre
  const [entityType, setEntityType] = useState("all")
  const [action, setAction] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const fetchAuditLog = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)

    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "50",
      })
      if (entityType !== "all") params.set("entity_type", entityType)
      if (action !== "all") params.set("action", action)
      if (dateFrom) params.set("date_from", dateFrom)
      if (dateTo) params.set("date_to", dateTo)

      const res = await fetch(`/api/settings/audit-log?${params}`)
      const json = await res.json()

      if (res.ok) {
        setEntries(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat audit log" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, entityType, action, dateFrom, dateTo, pagination.page, toast])

  const fetchSuspicious = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        action_type: "suspicious",
      })
      const res = await fetch(`/api/settings/audit-log?${params}`)
      const json = await res.json()
      if (res.ok) {
        setSuspicious(json.data || [])
      }
    } catch {
      // Ticho ignorujeme
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchAuditLog()
  }, [fetchAuditLog])

  useEffect(() => {
    fetchSuspicious()
  }, [fetchSuspicious])

  const handleExportCsv = async () => {
    if (!activeCompanyId) return
    setExporting(true)

    try {
      const filters: Record<string, string> = {}
      if (entityType !== "all") filters.entity_type = entityType
      if (action !== "all") filters.action = action
      if (dateFrom) filters.date_from = dateFrom
      if (dateTo) filters.date_to = dateTo

      const res = await fetch("/api/settings/audit-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: activeCompanyId, filters }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast({ title: "CSV exportovane" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa exportovat CSV" })
    } finally {
      setExporting(false)
    }
  }

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const getChangeSummary = (entry: AuditEntry): string => {
    if (entry.action === "create") return "Novy zaznam"
    if (entry.action === "delete") return "Zaznam vymazany"

    const oldVals = entry.old_values || {}
    const newVals = entry.new_values || {}
    const changes: string[] = []

    for (const key of Object.keys(newVals)) {
      if (key.startsWith("_")) continue
      if (JSON.stringify(oldVals[key]) !== JSON.stringify(newVals[key])) {
        changes.push(key)
      }
    }

    if (changes.length === 0) return "-"
    if (changes.length <= 3) return changes.join(", ")
    return `${changes.slice(0, 3).join(", ")} (+${changes.length - 3})`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">Historia vsetkych zmien v systeme</p>
        </div>
        <Button onClick={handleExportCsv} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Exportujem..." : "Exportovat CSV"}
        </Button>
      </div>

      {/* Podozriva aktivita */}
      {suspicious.length > 0 && (
        <div className="mb-6 space-y-3">
          {suspicious.map((item, idx) => (
            <Card key={idx} className="border-orange-300 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    {item.type === "mass_deletion" && "Masove mazanie detekovane"}
                    {item.type === "unusual_login" && "Nezvycajne prihlasovanie"}
                    {item.type === "locked_period_change" && "Zmena uzavreteho obdobia"}
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">{item.description}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Detekovane: {formatTimestamp(item.detected_at)} | Zavaznost:{" "}
                    <span className={item.severity === "high" ? "font-bold" : ""}>
                      {item.severity === "high" ? "Vysoka" : item.severity === "medium" ? "Stredna" : "Nizka"}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filtre */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap gap-4 p-4">
          <div className="w-48">
            <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPagination(p => ({ ...p, page: 1 })) }}>
              <SelectTrigger>
                <SelectValue placeholder="Typ entity" />
              </SelectTrigger>
              <SelectContent>
                {entityTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={action} onValueChange={(v) => { setAction(v); setPagination(p => ({ ...p, page: 1 })) }}>
              <SelectTrigger>
                <SelectValue placeholder="Akcia" />
              </SelectTrigger>
              <SelectContent>
                {actionOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
              placeholder="Od"
            />
          </div>
          <div className="w-44">
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
              placeholder="Do"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabulka */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium w-8"></th>
                  <th className="h-10 px-4 text-left font-medium">Cas</th>
                  <th className="h-10 px-4 text-left font-medium">Pouzivatel</th>
                  <th className="h-10 px-4 text-left font-medium">Akcia</th>
                  <th className="h-10 px-4 text-left font-medium">Entita</th>
                  <th className="h-10 px-4 text-left font-medium">Detail</th>
                  <th className="h-10 px-4 text-left font-medium">IP adresa</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nacitavam...
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Ziadne zaznamy v audit logu.</p>
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="group">
                      <td colSpan={7} className="p-0">
                        <div
                          className="flex items-center border-b hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedRow(expandedRow === entry.id ? null : entry.id)}
                        >
                          <div className="h-10 px-4 flex items-center w-8">
                            {expandedRow === entry.id ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="h-10 px-4 flex items-center min-w-[160px]">
                            <Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                            <span className="text-xs">{formatTimestamp(entry.timestamp)}</span>
                          </div>
                          <div className="h-10 px-4 flex items-center min-w-[160px]">
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {entry.user_email || entry.user_id.slice(0, 8) + "..."}
                            </span>
                          </div>
                          <div className="h-10 px-4 flex items-center min-w-[120px]">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${actionColors[entry.action] || "bg-gray-100 text-gray-700"}`}>
                              {actionLabels[entry.action] || entry.action}
                            </span>
                          </div>
                          <div className="h-10 px-4 flex items-center min-w-[140px]">
                            <span className="text-xs">
                              {entityTypeLabels[entry.entity_type] || entry.entity_type}
                            </span>
                          </div>
                          <div className="h-10 px-4 flex items-center flex-1">
                            <span className="text-xs text-muted-foreground truncate">
                              {getChangeSummary(entry)}
                            </span>
                          </div>
                          <div className="h-10 px-4 flex items-center min-w-[120px]">
                            <span className="text-xs text-muted-foreground">
                              {entry.ip_address || "-"}
                            </span>
                          </div>
                        </div>

                        {/* Rozsireny detail */}
                        {expandedRow === entry.id && (
                          <div className="px-12 py-4 bg-muted/20 border-b">
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">
                                  Stare hodnoty
                                </h4>
                                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
                                  {entry.old_values
                                    ? JSON.stringify(
                                        Object.fromEntries(
                                          Object.entries(entry.old_values).filter(([k]) => !k.startsWith("_"))
                                        ),
                                        null,
                                        2
                                      )
                                    : "null"}
                                </pre>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">
                                  Nove hodnoty
                                </h4>
                                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
                                  {entry.new_values
                                    ? JSON.stringify(
                                        Object.fromEntries(
                                          Object.entries(entry.new_values).filter(([k]) => !k.startsWith("_"))
                                        ),
                                        null,
                                        2
                                      )
                                    : "null"}
                                </pre>
                              </div>
                            </div>
                            {entry.user_agent && (
                              <p className="text-xs text-muted-foreground mt-3">
                                User Agent: {entry.user_agent}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              ID entity: {entry.entity_id}
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Strankovanie */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {pagination.total} zaznamov celkovo
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Predchadzajuca
                </Button>
                <span className="flex items-center text-sm text-muted-foreground px-2">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  Dalsia
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

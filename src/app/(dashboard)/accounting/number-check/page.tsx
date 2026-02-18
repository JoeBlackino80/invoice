"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  FileSearch,
} from "lucide-react"

interface NumberCheckResult {
  document_type: string
  count: number
  first_number: string | null
  last_number: string | null
  has_gaps: boolean
  has_duplicates: boolean
  has_issues: boolean
  gaps: string[]
  duplicates: string[]
  details: string[]
}

const documentTypeLabels: Record<string, string> = {
  FA: "Faktúra vydaná",
  PFA: "Prijatá faktúra",
  ID: "Interný doklad",
  BV: "Bankový výpis",
  PPD: "Príjmový pokladničný doklad",
  VPD: "Výdavkový pokladničný doklad",
}

export default function NumberCheckPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [results, setResults] = useState<NumberCheckResult[]>([])
  const [loading, setLoading] = useState(true)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)

  const fetchCheck = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/accounting/number-check?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setResults(json.data || [])
        setCheckedAt(json.checked_at || null)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa vykonať kontrolu" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vykonať kontrolu číslovania" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchCheck()
  }, [fetchCheck])

  const totalIssues = results.filter((r) => r.has_issues).length
  const allOk = results.length > 0 && totalIssues === 0

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kontrola číslovania</h1>
          <p className="text-muted-foreground">
            Kontrola súvislosti číslovania účtovných dokladov
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && results.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {allOk ? (
                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                  <CheckCircle2 className="h-5 w-5" />
                  Všetko v poriadku
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-destructive font-medium">
                  <XCircle className="h-5 w-5" />
                  {totalIssues} {totalIssues === 1 ? "problém" : totalIssues < 5 ? "problémy" : "problémov"}
                </span>
              )}
            </span>
          )}
          <Button onClick={fetchCheck} variant="outline" disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Skontrolovať
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Typ dokladu</th>
                  <th className="h-10 px-4 text-center font-medium">Počet</th>
                  <th className="h-10 px-4 text-left font-medium">Prvé číslo</th>
                  <th className="h-10 px-4 text-left font-medium">Posledné číslo</th>
                  <th className="h-10 px-4 text-center font-medium">Stav</th>
                  <th className="h-10 px-4 text-left font-medium">Podrobnosti</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      <p>Kontrolujem číslovanie...</p>
                    </td>
                  </tr>
                ) : results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      <FileSearch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Žiadne účtovné záznamy na kontrolu.</p>
                    </td>
                  </tr>
                ) : (
                  results.map((result) => (
                    <tr
                      key={result.document_type}
                      className={`border-b hover:bg-muted/30 transition-colors ${
                        result.has_issues ? "bg-red-50/50 dark:bg-red-950/10" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">
                        {documentTypeLabels[result.document_type] || result.document_type}
                        <span className="ml-2 text-xs text-muted-foreground font-mono">
                          ({result.document_type})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{result.count}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {result.first_number || "–"}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {result.last_number || "–"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {result.has_issues ? (
                          <XCircle className="h-5 w-5 text-destructive mx-auto" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {result.details.length > 0 ? (
                          <ul className="list-disc list-inside text-xs space-y-0.5">
                            {result.details.map((detail, i) => (
                              <li key={i} className="text-destructive">
                                {detail}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-green-600 dark:text-green-400">
                            Bez medzier
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {checkedAt && (
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              Posledná kontrola: {new Date(checkedAt).toLocaleString("sk-SK")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

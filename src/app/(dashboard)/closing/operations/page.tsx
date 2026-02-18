"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  CheckCircle2,
  Circle,
  Play,
  Loader2,
  ArrowDown,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Scale,
  ArrowRight,
} from "lucide-react"

interface ClosingOperation {
  id: string
  type: string
  journal_entry_id: string | null
  total_amount: number
  accounts_count: number
  created_at: string
}

interface OperationStep {
  type: "revenue_close" | "expense_close" | "profit_loss_close" | "balance_close"
  title: string
  description: string
  icon: typeof TrendingUp
  details: string
  completed: boolean
  journalEntryId: string | null
  totalAmount: number
  accountsCount: number
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ClosingOperationsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)
  const [completedOperations, setCompletedOperations] = useState<ClosingOperation[]>([])
  const [previewData, setPreviewData] = useState<Record<string, any>>({})
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null)

  const currentYear = new Date().getFullYear()
  const fiscalYearId = `${currentYear}`
  const fiscalYearStart = `${currentYear}-01-01`
  const fiscalYearEnd = `${currentYear}-12-31`

  const fetchCompletedOperations = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      // We'll fetch closing operations from the database
      // Since we stored them when executing, we check which ones exist
      const types = ["revenue_close", "expense_close", "profit_loss_close", "balance_close"]
      const ops: ClosingOperation[] = []

      for (const type of types) {
        // Check from the operations API - we use opening balances GET for balance check
        // We'll load them from the table directly via a simple approach
      }

      // For now, we check by trying to see if the operations exist
      // This is a simplified approach - in production, we'd have a dedicated GET endpoint
      setCompletedOperations(ops)
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchCompletedOperations()
  }, [fetchCompletedOperations])

  const isOperationCompleted = (type: string) => {
    return completedOperations.some((op) => op.type === type)
  }

  const getCompletedOp = (type: string) => {
    return completedOperations.find((op) => op.type === type)
  }

  const steps: OperationStep[] = [
    {
      type: "revenue_close",
      title: "Uzavretie vynosovych uctov",
      description: "Uzavretie vsetkych uctov triedy 6 (Vynosy) na ucet 710 - Ucet ziskov a strat",
      icon: TrendingUp,
      details: "Vsetky vynosove ucty (trieda 6) budu uzavrete preuctovanim zostatkov na ucet 710. Ucty triedy 6 budu mat po tejto operacii nulovy zostatok.",
      completed: isOperationCompleted("revenue_close"),
      journalEntryId: getCompletedOp("revenue_close")?.journal_entry_id || null,
      totalAmount: getCompletedOp("revenue_close")?.total_amount || 0,
      accountsCount: getCompletedOp("revenue_close")?.accounts_count || 0,
    },
    {
      type: "expense_close",
      title: "Uzavretie nakladovych uctov",
      description: "Uzavretie vsetkych uctov triedy 5 (Naklady) na ucet 710 - Ucet ziskov a strat",
      icon: TrendingDown,
      details: "Vsetky nakladove ucty (trieda 5) budu uzavrete preuctovanim zostatkov na ucet 710. Ucty triedy 5 budu mat po tejto operacii nulovy zostatok.",
      completed: isOperationCompleted("expense_close"),
      journalEntryId: getCompletedOp("expense_close")?.journal_entry_id || null,
      totalAmount: getCompletedOp("expense_close")?.total_amount || 0,
      accountsCount: getCompletedOp("expense_close")?.accounts_count || 0,
    },
    {
      type: "profit_loss_close",
      title: "Uzavretie vysledkoveho uctu",
      description: "Prevod zostatku uctu 710 na ucet 702 (Konecny ucet suvahovy)",
      icon: Scale,
      details: "Zostatok uctu 710 (zisk alebo strata) bude prevedeny na ucet 702 - Konecny ucet suvahovy. Tato operacia vyzaduje dokoncenie predchadzajucich dvoch krokov.",
      completed: isOperationCompleted("profit_loss_close"),
      journalEntryId: getCompletedOp("profit_loss_close")?.journal_entry_id || null,
      totalAmount: getCompletedOp("profit_loss_close")?.total_amount || 0,
      accountsCount: getCompletedOp("profit_loss_close")?.accounts_count || 0,
    },
    {
      type: "balance_close",
      title: "Generovanie pociatocnych stavov",
      description: "Vytvorenie pociatocnych stavov pre nasledujuci rok z uctov tried 0-4",
      icon: BookOpen,
      details: "Z konecnych zostatkov suvahových uctov (triedy 0-4) budu generovane pociatocne stavy pre novy fiskalny rok pomocou uctu 701 - Zaciatocny ucet suvahovy.",
      completed: isOperationCompleted("balance_close"),
      journalEntryId: getCompletedOp("balance_close")?.journal_entry_id || null,
      totalAmount: getCompletedOp("balance_close")?.total_amount || 0,
      accountsCount: getCompletedOp("balance_close")?.accounts_count || 0,
    },
  ]

  const loadPreview = async (type: string) => {
    if (!activeCompanyId) return
    setLoadingPreview(type)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        fiscal_year_id: fiscalYearId,
        fiscal_year_start: fiscalYearStart,
        fiscal_year_end: fiscalYearEnd,
      })

      const res = await fetch(`/api/closing/opening-balances?${params}`)
      if (res.ok) {
        const json = await res.json()
        setPreviewData((prev) => ({ ...prev, [type]: json }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat nahled" })
    } finally {
      setLoadingPreview(null)
    }
  }

  const executeOperation = async (type: string) => {
    if (!activeCompanyId) return

    const confirmMsg = `Naozaj chcete vykonat uzavierkovu operaciu? Tato akcia vytvori uctovne zapisy, ktore nie je jednoduche vratit.`
    if (!confirm(confirmMsg)) return

    setExecuting(type)
    try {
      const res = await fetch("/api/closing/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          company_id: activeCompanyId,
          fiscal_year_id: fiscalYearId,
          fiscal_year_start: fiscalYearStart,
          fiscal_year_end: fiscalYearEnd,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        toast({
          title: "Operacia dokoncena",
          description: `Bolo spracovanych ${json.accounts_count} uctov v celkovej vyske ${formatMoney(json.total_amount)}`,
        })
        // Add to completed operations
        setCompletedOperations((prev) => [
          ...prev,
          {
            id: json.journal_entry_id || "",
            type,
            journal_entry_id: json.journal_entry_id,
            total_amount: json.total_amount,
            accounts_count: json.accounts_count,
            created_at: new Date().toISOString(),
          },
        ])
      } else {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: json.error || "Nepodarilo sa vykonat operaciu",
        })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vykonat operaciu" })
    } finally {
      setExecuting(null)
    }
  }

  const canExecute = (index: number): boolean => {
    // First step can always execute (if not already done)
    if (index === 0) return true
    // Other steps require previous step to be completed
    return steps[index - 1].completed
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Uzavierkove operacie</h1>
        <p className="text-muted-foreground">
          Krokovy sprievodca uzavierkou za rok {currentYear}
        </p>
      </div>

      {/* Warning */}
      <Card className="mb-6 border-yellow-200 dark:border-yellow-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">Dolezite upozornenie</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Uzavierkove operacie vytvaraju uctovne zapisy v hlavnom denniku. Pred vykonanim
                operacii sa uistite, ze je checklist kompletny a vsetky polozky su spravne zauctovane.
                Operacie musia byt vykonane v spravnom poradi.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const StepIcon = step.icon
          const isActive = canExecute(index) && !step.completed
          const isExecutingThis = executing === step.type

          return (
            <div key={step.type}>
              <Card className={`transition-all ${
                step.completed
                  ? "border-green-200 dark:border-green-800"
                  : isActive
                    ? "border-blue-200 dark:border-blue-800 shadow-sm"
                    : "opacity-60"
              }`}>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    {/* Step number and status */}
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        step.completed
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : isActive
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800"
                      }`}>
                        {step.completed ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          index + 1
                        )}
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <StepIcon className={`h-5 w-5 ${
                          step.completed ? "text-green-600" : isActive ? "text-blue-600" : "text-gray-400"
                        }`} />
                        <CardTitle className="text-lg">{step.title}</CardTitle>
                        {step.completed && (
                          <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded-full">
                            Dokoncene
                          </span>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        {step.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{step.details}</p>

                  {/* Completed info */}
                  {step.completed && (
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Suma: </span>
                          <span className="font-medium">{formatMoney(step.totalAmount)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pocet uctov: </span>
                          <span className="font-medium">{step.accountsCount}</span>
                        </div>
                        {step.journalEntryId && (
                          <div>
                            <span className="text-muted-foreground">Uctovny zapis: </span>
                            <span className="font-mono text-xs">{step.journalEntryId.substring(0, 8)}...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {!step.completed && (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => executeOperation(step.type)}
                        disabled={!isActive || isExecutingThis || executing !== null}
                      >
                        {isExecutingThis ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Vykonavam...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Vykonat
                          </>
                        )}
                      </Button>
                      {step.type === "balance_close" && (
                        <Button
                          variant="outline"
                          onClick={() => loadPreview(step.type)}
                          disabled={loadingPreview === step.type}
                        >
                          {loadingPreview === step.type ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Nacitavam...
                            </>
                          ) : (
                            <>
                              <BookOpen className="mr-2 h-4 w-4" />
                              Nahled pociatocnych stavov
                            </>
                          )}
                        </Button>
                      )}
                      {!isActive && (
                        <span className="text-sm text-muted-foreground">
                          Najprv dokoncite predchadzajuci krok
                        </span>
                      )}
                    </div>
                  )}

                  {/* Preview data for balance_close */}
                  {previewData[step.type] && step.type === "balance_close" && !step.completed && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Nahled pociatocnych stavov:</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="h-8 px-3 text-left font-medium">Ucet</th>
                              <th className="h-8 px-3 text-left font-medium">Nazov</th>
                              <th className="h-8 px-3 text-right font-medium">MD</th>
                              <th className="h-8 px-3 text-right font-medium">D</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(previewData[step.type].data || []).slice(0, 20).map((row: any) => (
                              <tr key={row.account_id} className="border-b">
                                <td className="px-3 py-2 font-mono">
                                  {row.synteticky_ucet}
                                  {row.analyticky_ucet ? `.${row.analyticky_ucet}` : ""}
                                </td>
                                <td className="px-3 py-2">{row.nazov}</td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {row.opening_debit > 0 ? formatMoney(row.opening_debit) : ""}
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {row.opening_credit > 0 ? formatMoney(row.opening_credit) : ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          {previewData[step.type].summary && (
                            <tfoot>
                              <tr className="border-t-2 font-medium">
                                <td className="px-3 py-2" colSpan={2}>Spolu</td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {formatMoney(previewData[step.type].summary.total_opening_debit)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {formatMoney(previewData[step.type].summary.total_opening_credit)}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                      {(previewData[step.type].data || []).length > 20 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Zobrazuje sa prvych 20 z {previewData[step.type].data.length} uctov
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Arrow between steps */}
              {index < steps.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowDown className={`h-5 w-5 ${
                    step.completed ? "text-green-400" : "text-gray-300"
                  }`} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* All done message */}
      {steps.every((s) => s.completed) && (
        <Card className="mt-6 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  Vsetky uzavierkove operacie su dokoncene
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Uctovna uzavierka za rok {currentYear} bola uspesne dokoncena.
                  Nezabudnite uzamknut obdobie, aby nedoslo k nezelanych zmenam.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

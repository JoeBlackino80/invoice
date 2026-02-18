"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  CheckSquare,
  ArrowRight,
  BookOpen,
  Lock,
  Calculator,
  ClipboardCheck,
  Loader2,
} from "lucide-react"

interface ChecklistProgress {
  total: number
  done: number
  skipped: number
  na: number
  pending: number
  percentage: number
  isComplete: boolean
}

interface ClosingOperation {
  id: string
  type: string
  journal_entry_id: string | null
  total_amount: number
  accounts_count: number
  created_at: string
}

interface PeriodLock {
  id: string
  period_start: string
  period_end: string
  locked: boolean
}

const operationLabels: Record<string, string> = {
  revenue_close: "Uzavretie vynosovych uctov",
  expense_close: "Uzavretie nakladovych uctov",
  profit_loss_close: "Uzavretie vysledkoveho uctu",
  balance_close: "Generovanie pociatocnych stavov",
}

export default function ClosingPage() {
  const { activeCompanyId, activeCompany } = useCompany()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<ChecklistProgress | null>(null)
  const [operations, setOperations] = useState<ClosingOperation[]>([])
  const [periodLocks, setPeriodLocks] = useState<PeriodLock[]>([])

  const currentYear = new Date().getFullYear()
  const fiscalYearId = `${currentYear}`
  const fiscalYearStart = `${currentYear}-01-01`
  const fiscalYearEnd = `${currentYear}-12-31`

  const fetchData = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      // Fetch checklist progress
      const checklistRes = await fetch(
        `/api/closing/checklist?company_id=${activeCompanyId}&fiscal_year_id=${fiscalYearId}`
      )
      if (checklistRes.ok) {
        const checklistJson = await checklistRes.json()
        setProgress(checklistJson.progress)
      }

      // Fetch period locks
      const locksRes = await fetch(
        `/api/closing/period-lock?company_id=${activeCompanyId}&fiscal_year=${currentYear}`
      )
      if (locksRes.ok) {
        const locksJson = await locksRes.json()
        setPeriodLocks(locksJson.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat udaje" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, fiscalYearId, currentYear, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const lockedCount = periodLocks.filter((l) => l.locked).length
  const completedOps = operations.length

  const navCards = [
    {
      title: "Checklist",
      description: "15 povinnych krokov pred uzavierkou. Overte, ze je vsetko pripravene.",
      icon: ClipboardCheck,
      href: "/closing/checklist",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      stat: progress ? `${progress.percentage}% hotovo` : "Nacitavam...",
    },
    {
      title: "Uzavierkove operacie",
      description: "Uzavretie vynosovych, nakladovych a vysledkovych uctov.",
      icon: Calculator,
      href: "/closing/operations",
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
      stat: `${completedOps} z 4 operacii`,
    },
    {
      title: "Uzamknutie obdobia",
      description: "Uzamknite ukoncene obdobia proti nezelanych zmenam.",
      icon: Lock,
      href: "/closing/period-lock",
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950",
      stat: `${lockedCount} uzamknutych obdobi`,
    },
  ]

  return (
    <div>
      <Breadcrumb />
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Zavierka</h1>
        <p className="text-muted-foreground">
          Rocna uzavierka pre {activeCompany?.name || "firmu"} - rok {currentYear}
        </p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fiskalny rok</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentYear}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {fiscalYearStart} - {fiscalYearEnd}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stav checklistu</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : progress ? (
              <>
                <div className="text-2xl font-bold">{progress.percentage}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {progress.done} splnenych z {progress.total} poloziek
                </p>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      progress.isComplete ? "bg-green-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="text-2xl font-bold">-</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Uzamknute obdobia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lockedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              z celkoveho poctu obdobi
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {navCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${card.bgColor}`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle className="text-base mt-3">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{card.description}</p>
                <div className="flex items-center gap-2 text-xs">
                  <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground font-medium">{card.stat}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

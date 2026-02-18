"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  CheckCircle2,
  Circle,
  SkipForward,
  MinusCircle,
  RefreshCw,
  Loader2,
  ClipboardCheck,
  Info,
} from "lucide-react"

type ChecklistStatus = "pending" | "done" | "skipped" | "na"

interface ChecklistItem {
  id: string
  name: string
  description: string
  status: ChecklistStatus
  required: boolean
  autoVerifiable: boolean
  note?: string
}

interface ChecklistProgress {
  total: number
  done: number
  skipped: number
  na: number
  pending: number
  percentage: number
  isComplete: boolean
}

const statusConfig: Record<ChecklistStatus, { label: string; icon: typeof CheckCircle2; color: string; bgColor: string }> = {
  pending: { label: "Cakajuce", icon: Circle, color: "text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-800" },
  done: { label: "Splnene", icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900" },
  skipped: { label: "Preskocene", icon: SkipForward, color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-900" },
  na: { label: "Neaplikovatelne", icon: MinusCircle, color: "text-gray-500", bgColor: "bg-gray-100 dark:bg-gray-800" },
}

export default function ClosingChecklistPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [progress, setProgress] = useState<ChecklistProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [updatingItem, setUpdatingItem] = useState<string | null>(null)

  const currentYear = new Date().getFullYear()
  const fiscalYearId = `${currentYear}`
  const fiscalYearStart = `${currentYear}-01-01`
  const fiscalYearEnd = `${currentYear}-12-31`

  const fetchChecklist = useCallback(async (autoVerify = false) => {
    if (!activeCompanyId) return
    if (autoVerify) setVerifying(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        fiscal_year_id: fiscalYearId,
      })
      if (autoVerify) {
        params.set("auto_verify", "true")
        params.set("fiscal_year_start", fiscalYearStart)
        params.set("fiscal_year_end", fiscalYearEnd)
      }

      const res = await fetch(`/api/closing/checklist?${params}`)
      const json = await res.json()

      if (res.ok) {
        setItems(json.data || [])
        setProgress(json.progress || null)
        if (autoVerify) {
          toast({ title: "Overenie dokoncene", description: "Automaticke overenie bolo vykonane" })
        }
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa nacitat checklist" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat checklist" })
    } finally {
      setLoading(false)
      setVerifying(false)
    }
  }, [activeCompanyId, fiscalYearId, fiscalYearStart, fiscalYearEnd, toast])

  useEffect(() => {
    fetchChecklist()
  }, [fetchChecklist])

  const updateItemStatus = async (itemId: string, status: ChecklistStatus) => {
    if (!activeCompanyId) return
    setUpdatingItem(itemId)

    try {
      const res = await fetch("/api/closing/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          fiscal_year_id: fiscalYearId,
          item_id: itemId,
          status,
        }),
      })

      if (res.ok) {
        // Update local state
        setItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, status } : item))
        )
        // Recalculate progress
        const updatedItems = items.map((item) =>
          item.id === itemId ? { ...item, status } : item
        )
        const total = updatedItems.length
        const done = updatedItems.filter((i) => i.status === "done").length
        const skipped = updatedItems.filter((i) => i.status === "skipped").length
        const na = updatedItems.filter((i) => i.status === "na").length
        const pending = updatedItems.filter((i) => i.status === "pending").length
        const relevantTotal = total - na
        const completedCount = done + skipped
        const percentage = relevantTotal > 0 ? Math.round((completedCount / relevantTotal) * 100) : 100
        const requiredPending = updatedItems.filter((i) => i.required && i.status === "pending").length
        setProgress({ total, done, skipped, na, pending, percentage, isComplete: requiredPending === 0 })

        toast({ title: "Ulozene", description: `Polozka bola oznacena ako ${statusConfig[status].label.toLowerCase()}` })
      } else {
        const json = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa ulozit zmenu" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit zmenu" })
    } finally {
      setUpdatingItem(null)
    }
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Checklist uzavierky</h1>
          <p className="text-muted-foreground">
            Povinne kroky pred uctovnou uzavierkou za rok {currentYear}
          </p>
        </div>
        <Button
          onClick={() => fetchChecklist(true)}
          disabled={verifying}
          variant="outline"
        >
          {verifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Overujem...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Automaticke overenie
            </>
          )}
        </Button>
      </div>

      {/* Progress bar */}
      {progress && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Celkovy priebeh</span>
              <span className="text-sm font-medium">{progress.percentage}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  progress.isComplete ? "bg-green-500" : progress.percentage >= 70 ? "bg-blue-500" : "bg-yellow-500"
                }`}
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                {progress.done} splnenych
              </span>
              <span className="flex items-center gap-1">
                <SkipForward className="h-3 w-3 text-yellow-600" />
                {progress.skipped} preskocenych
              </span>
              <span className="flex items-center gap-1">
                <MinusCircle className="h-3 w-3 text-gray-500" />
                {progress.na} neaplikovatelnych
              </span>
              <span className="flex items-center gap-1">
                <Circle className="h-3 w-3 text-gray-400" />
                {progress.pending} cakajucich
              </span>
            </div>
            {progress.isComplete && (
              <div className="mt-3 p-2 bg-green-50 dark:bg-green-950 rounded text-sm text-green-700 dark:text-green-300">
                Vsetky povinne polozky su splnene. Mozete pokracovat s uzavierkovymi operaciami.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Checklist items */}
      <div className="space-y-3">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              Nacitavam checklist...
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Ziadne polozky v checkliste.</p>
            </CardContent>
          </Card>
        ) : (
          items.map((item, index) => {
            const config = statusConfig[item.status]
            const StatusIcon = config.icon
            const isUpdating = updatingItem === item.id

            return (
              <Card key={item.id} className={`transition-all ${item.status === "done" ? "opacity-80" : ""}`}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    {/* Index and status icon */}
                    <div className="flex items-center gap-3 min-w-[60px]">
                      <span className="text-sm font-mono text-muted-foreground w-6 text-right">
                        {index + 1}.
                      </span>
                      <StatusIcon className={`h-5 w-5 ${config.color} flex-shrink-0`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-medium ${item.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                          {item.name}
                        </h3>
                        {item.required && (
                          <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-1.5 py-0.5 rounded">
                            Povinne
                          </span>
                        )}
                        {item.autoVerifiable && (
                          <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded">
                            Auto
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      {item.note && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          {item.note}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {item.status !== "done" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                              onClick={() => updateItemStatus(item.id, "done")}
                              title="Oznacit ako splnene"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Splnene
                            </Button>
                          )}
                          {item.status !== "skipped" && !item.required && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950"
                              onClick={() => updateItemStatus(item.id, "skipped")}
                              title="Preskocit"
                            >
                              <SkipForward className="h-4 w-4 mr-1" />
                              Preskocit
                            </Button>
                          )}
                          {item.status !== "na" && !item.required && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
                              onClick={() => updateItemStatus(item.id, "na")}
                              title="Neaplikovatelne"
                            >
                              <MinusCircle className="h-4 w-4 mr-1" />
                              N/A
                            </Button>
                          )}
                          {item.status !== "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-gray-400 hover:text-gray-500"
                              onClick={() => updateItemStatus(item.id, "pending")}
                              title="Resetovat"
                            >
                              <Circle className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

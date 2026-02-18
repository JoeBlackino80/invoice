"use client"

import { useCompany } from "@/hooks/use-company"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  ArrowLeft,
  Check,
} from "lucide-react"
import Link from "next/link"

interface WidgetConfig {
  id: string
  label: string
  visible: boolean
  order: number
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "quick-metrics", label: "Rychle metriky", visible: true, order: 0 },
  { id: "revenue-chart", label: "Trzby", visible: true, order: 1 },
  { id: "expense-chart", label: "Naklady podla kategorie", visible: true, order: 2 },
  { id: "cash-flow", label: "Cash flow", visible: true, order: 3 },
  { id: "vat-obligation", label: "DPH povinnost", visible: true, order: 4 },
  { id: "account-balances", label: "Stav uctov", visible: true, order: 5 },
  { id: "upcoming-deadlines", label: "Bliziace sa terminy", visible: true, order: 6 },
  { id: "unpaid-invoices", label: "Neuhradene faktury", visible: true, order: 7 },
  { id: "recent-activity", label: "Posledna aktivita", visible: true, order: 8 },
]

const WIDGET_DESCRIPTIONS: Record<string, string> = {
  "quick-metrics": "Obrat, zisk, pohladavky a zavazky na prvy pohlad",
  "revenue-chart": "Mesacny stlpcovy graf trzieb s porovnanim oproti minulemu roku",
  "expense-chart": "Rozdelenie nakladov podla kategorie (material, sluzby, mzdy...)",
  "cash-flow": "Mesacne porovnanie prijmov a vydavkov",
  "vat-obligation": "Aktualny stav DPH na vstupe, vystupe a rozdiel na odvod",
  "account-balances": "Zostatky na bankovych uctoch a v pokladniach",
  "upcoming-deadlines": "Bliziace sa splatnosti faktur a danove terminy",
  "unpaid-invoices": "Prehlad neuhradenych faktur s aging analyzou",
  "recent-activity": "Posledne akcie v systeme (faktury, platby, uctovania)",
}

export default function WidgetsConfigPage() {
  const { activeCompany, activeCompanyId, isLoading: companyLoading } = useCompany()
  const router = useRouter()

  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/dashboard/widgets?company_id=${activeCompanyId}`
      )
      if (res.ok) {
        const json = await res.json()
        if (json.widgets) {
          setWidgets(json.widgets)
        }
      }
    } catch {
      // Try localStorage fallback
      try {
        const stored = localStorage.getItem(`dashboard_widgets_${activeCompanyId}`)
        if (stored) {
          setWidgets(JSON.parse(stored))
        }
      } catch {
        // Use defaults
      }
    }
    setLoading(false)
  }, [activeCompanyId])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const toggleWidget = (id: string) => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, visible: !w.visible } : w
      )
    )
    setSaved(false)
  }

  const moveWidget = (id: string, direction: "up" | "down") => {
    setWidgets((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex((w) => w.id === id)
      if (idx < 0) return prev
      if (direction === "up" && idx > 0) {
        const temp = sorted[idx].order
        sorted[idx].order = sorted[idx - 1].order
        sorted[idx - 1].order = temp
      } else if (direction === "down" && idx < sorted.length - 1) {
        const temp = sorted[idx].order
        sorted[idx].order = sorted[idx + 1].order
        sorted[idx + 1].order = temp
      }
      return sorted
    })
    setSaved(false)
  }

  const resetToDefault = () => {
    setWidgets(DEFAULT_WIDGETS.map((w) => ({ ...w })))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!activeCompanyId) return
    setSaving(true)

    try {
      const res = await fetch("/api/dashboard/widgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          widgets,
        }),
      })

      if (!res.ok) {
        // Fallback to localStorage
        localStorage.setItem(
          `dashboard_widgets_${activeCompanyId}`,
          JSON.stringify(widgets)
        )
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // Fallback to localStorage
      try {
        localStorage.setItem(
          `dashboard_widgets_${activeCompanyId}`,
          JSON.stringify(widgets)
        )
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch {
        // Ignore
      }
    }

    setSaving(false)
  }

  if (companyLoading || !activeCompany) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Nacitavam...</p>
      </div>
    )
  }

  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order)

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nastavenie widgetov</h1>
          <p className="text-muted-foreground">
            Upravte zobrazenie a poradie widgetov na dashboarde
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Spat na dashboard
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Dostupne widgety</CardTitle>
              <CardDescription>
                Zapnite alebo vypnite widgety a upravte ich poradie
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetToDefault}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Predvolene
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saved ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Ulozene
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Ukladam..." : "Ulozit"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedWidgets.map((widget, idx) => (
                <div key={widget.id}>
                  <div
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                      widget.visible
                        ? "bg-background border-border"
                        : "bg-muted/50 border-muted opacity-60"
                    }`}
                  >
                    {/* Drag handle (visual only) */}
                    <div className="cursor-grab text-muted-foreground">
                      <GripVertical className="h-5 w-5" />
                    </div>

                    {/* Order controls */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                        onClick={() => moveWidget(widget.id, "up")}
                        disabled={idx === 0}
                        aria-label="Posun hore"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M6 2L10 8H2L6 2Z" fill="currentColor" />
                        </svg>
                      </button>
                      <button
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                        onClick={() => moveWidget(widget.id, "down")}
                        disabled={idx === sortedWidgets.length - 1}
                        aria-label="Posun dole"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M6 10L2 4H10L6 10Z" fill="currentColor" />
                        </svg>
                      </button>
                    </div>

                    {/* Widget info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{widget.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {WIDGET_DESCRIPTIONS[widget.id] || ""}
                      </p>
                    </div>

                    {/* Toggle */}
                    <Button
                      variant={widget.visible ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleWidget(widget.id)}
                      className="shrink-0"
                    >
                      {widget.visible ? (
                        <>
                          <Eye className="h-4 w-4 mr-1.5" />
                          Viditelne
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-4 w-4 mr-1.5" />
                          Skryte
                        </>
                      )}
                    </Button>
                  </div>
                  {idx < sortedWidgets.length - 1 && <Separator className="my-0" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 text-sm text-muted-foreground text-center">
        <p>Zmeny sa prejavia po ulozeni a navrate na dashboard.</p>
      </div>
    </div>
  )
}

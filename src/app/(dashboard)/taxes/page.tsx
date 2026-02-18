"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Calculator,
  FileText,
  ClipboardList,
  Landmark,
  Building,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react"

interface TaxReturn {
  id: string
  type: string
  period_from: string
  period_to: string
  status: string
  recognition_type: string
  submitted_at: string | null
  created_at: string
}

const typeLabels: Record<string, string> = {
  dph: "DPH",
  kv_dph: "KV DPH",
  sv: "Suhrnny vykaz",
  dppo: "Dan z prijmov PO",
  dpfo: "Dan z prijmov FO",
}

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: "Koncept", class: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  final: { label: "Finalizovane", class: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  submitted: { label: "Podane", class: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

export default function TaxesPage() {
  const { activeCompanyId, activeCompany } = useCompany()
  const { toast } = useToast()
  const [recentReturns, setRecentReturns] = useState<TaxReturn[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecentReturns = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/tax-returns?company_id=${activeCompanyId}&limit=5`)
      const json = await res.json()
      if (res.ok) {
        setRecentReturns(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat danove priznania" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchRecentReturns()
  }, [fetchRecentReturns])

  // Find last submission for each type
  const getLastSubmission = (type: string) => {
    const submitted = recentReturns.find(r => r.type === type && r.status === "submitted")
    return submitted
  }

  // Tax deadlines (simplified - in reality these depend on period type)
  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()

  // DPH is due 25th of the following month
  const dphDeadline = new Date(currentYear, currentMonth, 25)
  // KV DPH same deadline as DPH
  const kvdphDeadline = new Date(currentYear, currentMonth, 25)

  const taxCards = [
    {
      title: "DPH priznanie",
      description: "Priznanie k dani z pridanej hodnoty",
      icon: Calculator,
      href: "/taxes/dph",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      lastSubmission: getLastSubmission("dph"),
      deadline: dphDeadline,
    },
    {
      title: "Kontrolny vykaz DPH",
      description: "Kontrolny vykaz k dani z pridanej hodnoty",
      icon: ClipboardList,
      href: "/taxes/kvdph",
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
      lastSubmission: getLastSubmission("kv_dph"),
      deadline: kvdphDeadline,
    },
    {
      title: "Suhrnny vykaz",
      description: "Suhrnny vykaz k DPH pre dodavky do EU",
      icon: FileText,
      href: "/taxes/sv",
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      lastSubmission: getLastSubmission("sv"),
      deadline: null,
    },
    {
      title: "Dan z prijmov",
      description: "Priznanie k dani z prijmov pravnickych a fyzickych osob",
      icon: Landmark,
      href: "/taxes/income-tax",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
      lastSubmission: getLastSubmission("dppo") || getLastSubmission("dpfo"),
      deadline: null,
    },
    {
      title: "Odpisy",
      description: "Danova evidencia odpisov dlhodobeho majetku",
      icon: Building,
      href: "/taxes/depreciation",
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950",
      lastSubmission: null,
      deadline: null,
    },
  ]

  return (
    <div>
      <Breadcrumb />
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dane</h1>
        <p className="text-muted-foreground">
          Danove priznania a vykazy pre {activeCompany?.name || "firmu"}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktualne obdobie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMonth}/{currentYear}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Mesiac {currentMonth}, rok {currentYear}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">DPH termin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDate(dphDeadline.toISOString())}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Termin na podanie DPH a KV DPH
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Podane priznania</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recentReturns.filter(r => r.status === "submitted").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Celkom podanych danovych priznani
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tax type cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {taxCards.map((card) => (
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

                <div className="space-y-2">
                  {card.lastSubmission ? (
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-muted-foreground">
                        Posledne podanie: {formatDate(card.lastSubmission.submitted_at || card.lastSubmission.created_at)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs">
                      <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
                      <span className="text-muted-foreground">Ziadne podanie</span>
                    </div>
                  )}

                  {card.deadline && (
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-muted-foreground">
                        Dalsi termin: {formatDate(card.deadline.toISOString())}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent tax returns */}
      <Card>
        <CardHeader>
          <CardTitle>Posledne danove priznania</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Typ</th>
                  <th className="h-10 px-4 text-left font-medium">Obdobie</th>
                  <th className="h-10 px-4 text-left font-medium">Druh</th>
                  <th className="h-10 px-4 text-center font-medium">Stav</th>
                  <th className="h-10 px-4 text-left font-medium">Vytvorene</th>
                  <th className="h-10 px-4 text-left font-medium">Podane</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">Nacitavam...</td>
                  </tr>
                ) : recentReturns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      <div>
                        <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatial nemáte ziadne danove priznania.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentReturns.map((tr) => (
                    <tr key={tr.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{typeLabels[tr.type] || tr.type}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(tr.period_from)} - {formatDate(tr.period_to)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{tr.recognition_type}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusLabels[tr.status]?.class || ""
                        }`}>
                          {statusLabels[tr.status]?.label || tr.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(tr.created_at)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {tr.submitted_at ? formatDate(tr.submitted_at) : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Archive,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileArchive,
  Calendar,
  ShieldCheck,
} from "lucide-react"

// ============================================================================
// Types
// ============================================================================

interface ArchiveStatusItem {
  entity_type: string
  label: string
  total_count: number
  archived_count: number
  active_count: number
  oldest_record: string | null
  newest_record: string | null
  retention_years: number
  law: string
  status: "ok" | "warning" | "expired"
}

interface ExpiringRecord {
  entity_type: string
  entity_id: string
  retention_until: string
  days_remaining: number
  label: string
}

// ============================================================================
// Component
// ============================================================================

export default function ArchivePage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [archiveStatus, setArchiveStatus] = useState<ArchiveStatusItem[]>([])
  const [expiring, setExpiring] = useState<ExpiringRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [archiving, setArchiving] = useState(false)
  const [periodEnd, setPeriodEnd] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)

  const fetchArchiveStatus = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)

    try {
      const [statusRes, expiringRes] = await Promise.all([
        fetch(`/api/settings/archive?company_id=${activeCompanyId}`),
        fetch(`/api/settings/archive?company_id=${activeCompanyId}&action=expiring`),
      ])

      const statusJson = await statusRes.json()
      const expiringJson = await expiringRes.json()

      if (statusRes.ok) setArchiveStatus(statusJson.data || [])
      if (expiringRes.ok) setExpiring(expiringJson.data || [])
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat stav archivacie" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchArchiveStatus()
  }, [fetchArchiveStatus])

  const handleArchive = async () => {
    if (!activeCompanyId || !periodEnd) return
    setArchiving(true)

    try {
      const res = await fetch("/api/settings/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          action: "archive",
          period_end: periodEnd,
        }),
      })

      const json = await res.json()
      if (res.ok) {
        toast({
          title: "Archivacia dokoncena",
          description: `Archivovanych ${json.archived_count} zaznamov`,
        })
        setConfirmOpen(false)
        fetchArchiveStatus()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa archivovat obdobie" })
    } finally {
      setArchiving(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("sk-SK")
  }

  const getStatusBadge = (status: "ok" | "warning" | "expired") => {
    switch (status) {
      case "ok":
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />V poriadku
          </span>
        )
      case "warning":
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
            <AlertTriangle className="h-3 w-3 mr-1" />Blizi sa expiracia
          </span>
        )
      case "expired":
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
            <AlertTriangle className="h-3 w-3 mr-1" />Expirovane
          </span>
        )
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Archivacia</h1>
          <p className="text-muted-foreground">Sprava archivacie a retencnych lehot podla slovenskej legislativy</p>
        </div>
      </div>

      {/* Stav archivacie */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileArchive className="h-5 w-5" />
          Stav archivacie
        </h2>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Nacitavam...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {archiveStatus.map((item) => (
              <Card key={item.entity_type} className={
                item.status === "expired"
                  ? "border-red-300 dark:border-red-800"
                  : item.status === "warning"
                  ? "border-yellow-300 dark:border-yellow-800"
                  : ""
              }>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
                    {getStatusBadge(item.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Zaznamov:</span>
                      <span className="font-medium">{item.total_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Najstarsi:</span>
                      <span>{formatDate(item.oldest_record)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Najnovsi:</span>
                      <span>{formatDate(item.newest_record)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Retencia:</span>
                      <span className="font-medium">{item.retention_years} rokov</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.law}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator className="my-8" />

      {/* Archivacia obdobia */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Archivacia obdobia
        </h2>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-4">
              Archivujte vsetky doklady a zaznamy za uzavrete obdobie. Archivovane zaznamy budu
              oznacene a chranene pred zmazanim pocas retencnej lehoty.
            </p>
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <label className="text-sm font-medium mb-1.5 block">Koniec obdobia</label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>

              <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!periodEnd}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archivovat
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Potvrdenie archivacie</DialogTitle>
                    <DialogDescription>
                      Naozaj chcete archivovat vsetky zaznamy do {periodEnd ? new Date(periodEnd).toLocaleDateString("sk-SK") : ""}?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-2 text-sm">
                    <p>Budu archivovane:</p>
                    <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                      <li>Faktury</li>
                      <li>Uctovne zapisy</li>
                      <li>Bankove transakcie</li>
                      <li>Pokladnicne doklady</li>
                      <li>Dokumenty</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-3">
                      Retencne lehoty budu automaticky nastavene podla slovenskej legislativy.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                      Zrusit
                    </Button>
                    <Button onClick={handleArchive} disabled={archiving}>
                      {archiving ? "Archivujem..." : "Potvrdit archivaciu"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      {/* Blizace sa expiracie */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Blizace sa expiracie
        </h2>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium">Typ dokumentu</th>
                    <th className="h-10 px-4 text-left font-medium">ID zaznamu</th>
                    <th className="h-10 px-4 text-left font-medium">Retencia do</th>
                    <th className="h-10 px-4 text-left font-medium">Zostava dni</th>
                    <th className="h-10 px-4 text-left font-medium">Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="h-24 text-center text-muted-foreground">
                        <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Ziadne zaznamy sa neblizia k expiracii.</p>
                      </td>
                    </tr>
                  ) : (
                    expiring.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">{item.label}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                          {item.entity_id.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3">{formatDate(item.retention_until)}</td>
                        <td className="px-4 py-3">
                          <span className={item.days_remaining < 30 ? "text-red-600 font-medium" : item.days_remaining < 90 ? "text-yellow-600" : ""}>
                            {item.days_remaining} dni
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {item.days_remaining <= 0 ? (
                            <Badge variant="destructive">Expirovane</Badge>
                          ) : item.days_remaining < 30 ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                              Kriticke
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                              Varovanie
                            </span>
                          )}
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
    </div>
  )
}

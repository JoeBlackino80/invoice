"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Download,
  HardDrive,
  Clock,
  Database,
  Shield,
  Info,
  RefreshCw,
} from "lucide-react"

// ============================================================================
// Types
// ============================================================================

interface BackupEntry {
  id: string
  created_at: string
  user_id: string
  tables_exported: number
  records_exported: number
  size_estimate: string
}

// ============================================================================
// Component
// ============================================================================

export default function BackupPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const fetchBackups = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)

    try {
      const res = await fetch(`/api/settings/backup?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setBackups(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat zalohy" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchBackups()
  }, [fetchBackups])

  const handleCreateBackup = async () => {
    if (!activeCompanyId) return
    setCreating(true)

    try {
      const res = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: activeCompanyId }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const disposition = res.headers.get("Content-Disposition") || ""
        const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
        a.download = filenameMatch ? filenameMatch[1] : `backup-${new Date().toISOString().split("T")[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast({ title: "Zaloha vytvorena", description: "Subor bol stiahnuty" })
        fetchBackups()
      } else {
        const json = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vytvorit zalohu" })
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zalohovanie</h1>
          <p className="text-muted-foreground">Sprava zaloh a export firemnych dat</p>
        </div>
        <Button onClick={handleCreateBackup} disabled={creating}>
          {creating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Vytváram zálohu...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Vytvorit zalohu
            </>
          )}
        </Button>
      </div>

      {/* Info karta o automatickych zalohach */}
      <Card className="mb-6 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">Automaticke zalohy</p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Supabase automaticky vytvara denne zalohy databazy. Tieto zalohy su spravovane
              na urovni infrastruktury a su dostupne cez Supabase dashboard. Manualny export
              nizsie sluzi na vytvorenie vlastnej kópie dat vo formate JSON.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Statistiky */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Manualne zalohy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{backups.length}</p>
            <p className="text-xs text-muted-foreground">exportov vytvorenych</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Posledna zaloha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {backups.length > 0 ? formatDate(backups[0].created_at) : "-"}
            </p>
            <p className="text-xs text-muted-foreground">datum posledneho exportu</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Automaticke zalohy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Denne</p>
            <p className="text-xs text-muted-foreground">Supabase infrastruktura</p>
          </CardContent>
        </Card>
      </div>

      {/* Zoznam zaloh */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historia manualnych exportov</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Datum</th>
                  <th className="h-10 px-4 text-left font-medium">Tabulky</th>
                  <th className="h-10 px-4 text-left font-medium">Zaznamy</th>
                  <th className="h-10 px-4 text-left font-medium">Velkost</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="h-24 text-center text-muted-foreground">
                      Nacitavam...
                    </td>
                  </tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="h-24 text-center text-muted-foreground">
                      <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Zatial neboli vytvorene ziadne manualne zalohy.</p>
                      <p className="text-xs mt-1">Kliknite na &quot;Vytvorit zalohu&quot; pre export dat.</p>
                    </td>
                  </tr>
                ) : (
                  backups.map((backup) => (
                    <tr key={backup.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDate(backup.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">{backup.tables_exported}</td>
                      <td className="px-4 py-3">{backup.records_exported.toLocaleString("sk-SK")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{backup.size_estimate}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Obnova dat */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Obnova dat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Obnova dat z manuálneho exportu vyzaduje manuálny proces:
            </p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Stiahnuty JSON subor obsahuje vsetky data firmy vo strukturovanom formate</li>
              <li>Pre obnovu kontaktujte administratora systemu</li>
              <li>Data budu importovane do novej alebo existujucej databazy</li>
              <li>Po importe skontrolujte integritu dat</li>
            </ol>
            <p className="mt-4">
              <strong>Pre obnovu z automatickej zalohy Supabase:</strong> Pouzite Supabase dashboard
              alebo kontaktujte podporu Supabase.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

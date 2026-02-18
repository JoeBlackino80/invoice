"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  BookTemplate,
  Download,
  Eye,
} from "lucide-react"

interface PredkontaciaLine {
  account_synteticky: string
  account_analyticky?: string
  side: "MD" | "D"
  is_amount_field: boolean
  fixed_amount?: number
  percentage?: number
  description?: string
}

interface Predkontacia {
  id: string
  name: string
  document_type: string
  description: string | null
  lines: PredkontaciaLine[]
  created_at: string
}

const documentTypeLabels: Record<string, string> = {
  FA: "FA",
  PFA: "PFA",
  ID: "ID",
  BV: "BV",
  PPD: "PPD",
  VPD: "VPD",
}

export default function PredkontaciePage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [predkontacie, setPredkontacie] = useState<Predkontacia[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  const fetchPredkontacie = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        limit: "100",
      })
      if (search) params.set("search", search)

      const res = await fetch(`/api/predkontacie?${params}`)
      const json = await res.json()

      if (res.ok) {
        setPredkontacie(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat predkontacie" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, search, toast])

  useEffect(() => {
    fetchPredkontacie()
  }, [fetchPredkontacie])

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tuto predkontaciu?")) return
    const res = await fetch(`/api/predkontacie/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Predkontacia odstranena" })
      fetchPredkontacie()
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "Chyba", description: err.error })
    }
    setMenuOpen(null)
  }

  const handleSeed = async () => {
    if (!activeCompanyId) return
    if (!confirm("Chcete vytvorit standardne Slovenske predkontacie pre tuto firmu?")) return

    setSeeding(true)
    try {
      const res = await fetch("/api/predkontacie/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: activeCompanyId }),
      })

      if (res.ok) {
        const data = await res.json()
        toast({ title: data.message || "Predkontacie vytvorene" })
        fetchPredkontacie()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vytvorit predkontacie" })
    } finally {
      setSeeding(false)
    }
  }

  const renderLinesPreview = (lines: PredkontaciaLine[]) => {
    const mdParts = lines.filter((l) => l.side === "MD").map((l) => l.account_synteticky)
    const dParts = lines.filter((l) => l.side === "D").map((l) => l.account_synteticky)
    return (
      <span className="font-mono text-xs">
        <span className="text-blue-600">{mdParts.join(" + ")}</span>
        <span className="text-muted-foreground"> / </span>
        <span className="text-orange-600">{dParts.join(" + ")}</span>
      </span>
    )
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Predkontacie</h1>
          <p className="text-muted-foreground">Sablony pre automaticke uctovanie dokladov</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeed} disabled={seeding}>
            <Download className="mr-2 h-4 w-4" />
            {seeding ? "Vytvaram..." : "Nahrat standardne"}
          </Button>
          <Link href="/accounting/predkontacie/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova predkontacia
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Hladat podla nazvu..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Nazov</th>
                  <th className="h-10 px-4 text-left font-medium w-24">Typ dokladu</th>
                  <th className="h-10 px-4 text-left font-medium">Kontacia (MD / D)</th>
                  <th className="h-10 px-4 text-left font-medium">Popis</th>
                  <th className="h-10 px-4 text-right font-medium w-20">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center text-muted-foreground">Nacitavam...</td>
                  </tr>
                ) : predkontacie.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center text-muted-foreground">
                      <div>
                        <BookTemplate className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatial nemate ziadne predkontacie.</p>
                        <button onClick={handleSeed} className="text-primary hover:underline text-sm" disabled={seeding}>
                          Nahrat standardne Slovenske predkontacie
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  predkontacie.map((pk) => (
                    <tr key={pk.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/accounting/predkontacie/${pk.id}`} className="font-medium hover:text-primary">
                          {pk.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {documentTypeLabels[pk.document_type] || pk.document_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {pk.lines && pk.lines.length > 0 ? renderLinesPreview(pk.lines) : "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {pk.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setMenuOpen(menuOpen === pk.id ? null : pk.id)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {menuOpen === pk.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
                                <Link
                                  href={`/accounting/predkontacie/${pk.id}`}
                                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                  onClick={() => setMenuOpen(null)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Upravit
                                </Link>
                                <button
                                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                  onClick={() => handleDelete(pk.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Odstranit
                                </button>
                              </div>
                            </>
                          )}
                        </div>
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

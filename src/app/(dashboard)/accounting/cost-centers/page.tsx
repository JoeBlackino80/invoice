"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Check,
  Building2,
  Loader2,
} from "lucide-react"

interface CostCenter {
  id: string
  code: string
  name: string
  description: string | null
  active: boolean
}

interface FormData {
  code: string
  name: string
  description: string
  active: boolean
}

const emptyForm: FormData = {
  code: "",
  name: "",
  description: "",
  active: true,
}

export default function CostCentersPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [centers, setCenters] = useState<CostCenter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchCenters = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "50",
      })
      if (search) params.set("search", search)

      const res = await fetch(`/api/cost-centers?${params}`)
      const json = await res.json()

      if (res.ok) {
        setCenters(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa nacitat strediska" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat strediska" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, search, pagination.page, toast])

  useEffect(() => {
    fetchCenters()
  }, [fetchCenters])

  const handleCreate = () => {
    setFormData(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  const handleEdit = (center: CostCenter) => {
    setFormData({
      code: center.code,
      name: center.name,
      description: center.description || "",
      active: center.active,
    })
    setEditingId(center.id)
    setShowForm(true)
    setMenuOpen(null)
  }

  const handleSave = async () => {
    if (!activeCompanyId) return
    if (!formData.code.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Kod strediska je povinny" })
      return
    }
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Nazov strediska je povinny" })
      return
    }

    setSaving(true)
    try {
      const url = editingId
        ? `/api/cost-centers/${editingId}`
        : "/api/cost-centers"
      const method = editingId ? "PUT" : "POST"

      const payload = editingId
        ? formData
        : { ...formData, company_id: activeCompanyId }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (res.ok) {
        toast({ title: editingId ? "Stredisko aktualizovane" : "Stredisko vytvorene" })
        setShowForm(false)
        setEditingId(null)
        setFormData(emptyForm)
        fetchCenters()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa ulozit stredisko" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit stredisko" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit toto stredisko?")) return

    try {
      const res = await fetch(`/api/cost-centers/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Stredisko odstranene" })
        fetchCenters()
      } else {
        const json = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa odstranit stredisko" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit stredisko" })
    }
    setMenuOpen(null)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(emptyForm)
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Strediska</h1>
          <p className="text-muted-foreground">Sprava nakladovych stredisk</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nove stredisko
        </Button>
      </div>

      {/* Formular pre vytvorenie/upravu */}
      {showForm && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingId ? "Upravit stredisko" : "Nove stredisko"}
              </h3>
              <Button variant="ghost" size="icon" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="code">Kod *</Label>
                <Input
                  id="code"
                  placeholder="napr. S01"
                  value={formData.code}
                  onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="name">Nazov *</Label>
                <Input
                  id="name"
                  placeholder="Nazov strediska"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="description">Popis</Label>
                <Input
                  id="description"
                  placeholder="Volitelny popis"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer h-9">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={formData.active}
                    onChange={(e) => setFormData((prev) => ({ ...prev, active: e.target.checked }))}
                  />
                  Aktivne
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {editingId ? "Ulozit zmeny" : "Vytvorit stredisko"}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Zrusit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Hladat podla kodu alebo nazvu..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
          />
        </div>
      </div>

      {/* Tabulka */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Kod</th>
                  <th className="h-10 px-4 text-left font-medium">Nazov</th>
                  <th className="h-10 px-4 text-left font-medium">Popis</th>
                  <th className="h-10 px-4 text-center font-medium">Stav</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Nacitavam...
                    </td>
                  </tr>
                ) : centers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center text-muted-foreground">
                      <div>
                        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatial nemate ziadne strediska.</p>
                        <button
                          onClick={handleCreate}
                          className="text-primary hover:underline text-sm"
                        >
                          Vytvorit prve stredisko
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  centers.map((center) => (
                    <tr key={center.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium">{center.code}</td>
                      <td className="px-4 py-3">{center.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{center.description || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        {center.active ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            Aktivne
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Neaktivne
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setMenuOpen(menuOpen === center.id ? null : center.id)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {menuOpen === center.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
                                <button
                                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                  onClick={() => handleEdit(center)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Upravit
                                </button>
                                <button
                                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                  onClick={() => handleDelete(center.id)}
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

          {/* Strankovanie */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {pagination.total} stredisk celkovo
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  Predchadzajuca
                </Button>
                <span className="flex items-center px-3 text-sm text-muted-foreground">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  Dalsia
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

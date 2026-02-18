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
  Download,
  X,
  Check,
  BookOpen,
  Loader2,
} from "lucide-react"

interface Account {
  id: string
  synteticky_ucet: string
  analyticky_ucet: string | null
  nazov: string
  typ: string
  danovy: boolean
  podsuvahovovy: boolean
  aktivny: boolean
}

const typLabels: Record<string, string> = {
  aktivny: "Aktivny",
  pasivny: "Pasivny",
  vynosovy: "Vynosovy",
  nakladovy: "Nakladovy",
}

const typColors: Record<string, string> = {
  aktivny: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  pasivny: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  vynosovy: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  nakladovy: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
}

const triedyLabels: Record<string, string> = {
  "0": "0 - Dlhodoby majetok",
  "1": "1 - Zasoby",
  "2": "2 - Financne ucty",
  "3": "3 - Zuctovacie vztahy",
  "4": "4 - Kapitalove ucty",
  "5": "5 - Naklady",
  "6": "6 - Vynosy",
  "7": "7 - Zavierkove ucty",
}

const typOptions = [
  { value: "", label: "Vsetky typy" },
  { value: "aktivny", label: "Aktivny" },
  { value: "pasivny", label: "Pasivny" },
  { value: "vynosovy", label: "Vynosovy" },
  { value: "nakladovy", label: "Nakladovy" },
]

const triedaOptions = [
  { value: "", label: "Vsetky triedy" },
  { value: "0", label: "0 - Dlhodoby majetok" },
  { value: "1", label: "1 - Zasoby" },
  { value: "2", label: "2 - Financne ucty" },
  { value: "3", label: "3 - Zuctovacie vztahy" },
  { value: "4", label: "4 - Kapitalove ucty" },
  { value: "5", label: "5 - Naklady" },
  { value: "6", label: "6 - Vynosy" },
  { value: "7", label: "7 - Zavierkove ucty" },
]

interface FormData {
  synteticky_ucet: string
  analyticky_ucet: string
  nazov: string
  typ: "aktivny" | "pasivny" | "vynosovy" | "nakladovy"
  danovy: boolean
  podsuvahovovy: boolean
  aktivny: boolean
}

const emptyForm: FormData = {
  synteticky_ucet: "",
  analyticky_ucet: "",
  nazov: "",
  typ: "aktivny",
  danovy: false,
  podsuvahovovy: false,
  aktivny: true,
}

export default function ChartOfAccountsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [search, setSearch] = useState("")
  const [typFilter, setTypFilter] = useState("")
  const [triedaFilter, setTriedaFilter] = useState("")
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchAccounts = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "50",
      })
      if (search) params.set("search", search)
      if (typFilter) params.set("typ", typFilter)
      if (triedaFilter) params.set("trieda", triedaFilter)

      const res = await fetch(`/api/chart-of-accounts?${params}`)
      const json = await res.json()

      if (res.ok) {
        setAccounts(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa nacitat ucty" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat ucty" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, search, typFilter, triedaFilter, pagination.page, toast])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const handleSeed = async () => {
    if (!activeCompanyId) return
    if (!confirm("Chcete naplnit uctovy rozvrh standardnymi slovenskymi uctami? Existujuce ucty nebudu dotknutne.")) return

    setSeeding(true)
    try {
      const res = await fetch("/api/chart-of-accounts/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: activeCompanyId }),
      })
      const json = await res.json()

      if (res.ok) {
        toast({ title: "Uctovy rozvrh naplneny", description: json.message })
        fetchAccounts()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa naplnit uctovy rozvrh" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa naplnit uctovy rozvrh" })
    } finally {
      setSeeding(false)
    }
  }

  const handleCreate = () => {
    setFormData(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  const handleEdit = (account: Account) => {
    setFormData({
      synteticky_ucet: account.synteticky_ucet,
      analyticky_ucet: account.analyticky_ucet || "",
      nazov: account.nazov,
      typ: account.typ as FormData["typ"],
      danovy: account.danovy,
      podsuvahovovy: account.podsuvahovovy,
      aktivny: account.aktivny,
    })
    setEditingId(account.id)
    setShowForm(true)
    setMenuOpen(null)
  }

  const handleSave = async () => {
    if (!activeCompanyId) return
    if (!formData.synteticky_ucet || formData.synteticky_ucet.length !== 3) {
      toast({ variant: "destructive", title: "Chyba", description: "Synteticky ucet musi mat presne 3 znaky" })
      return
    }
    if (!formData.nazov.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Nazov uctu je povinny" })
      return
    }

    setSaving(true)
    try {
      const url = editingId
        ? `/api/chart-of-accounts/${editingId}`
        : "/api/chart-of-accounts"
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
        toast({ title: editingId ? "Ucet aktualizovany" : "Ucet vytvoreny" })
        setShowForm(false)
        setEditingId(null)
        setFormData(emptyForm)
        fetchAccounts()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa ulozit ucet" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit ucet" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tento ucet?")) return

    try {
      const res = await fetch(`/api/chart-of-accounts/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Ucet odstraneny" })
        fetchAccounts()
      } else {
        const json = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa odstranit ucet" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit ucet" })
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
          <h1 className="text-3xl font-bold tracking-tight">Uctovy rozvrh</h1>
          <p className="text-muted-foreground">Sprava syntetickych a analytickych uctov</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeed} disabled={seeding}>
            {seeding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Naplnit standardne ucty
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novy ucet
          </Button>
        </div>
      </div>

      {/* Formular pre vytvorenie/upravu */}
      {showForm && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingId ? "Upravit ucet" : "Novy ucet"}
              </h3>
              <Button variant="ghost" size="icon" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="synteticky_ucet">Synteticky ucet *</Label>
                <Input
                  id="synteticky_ucet"
                  placeholder="napr. 311"
                  maxLength={3}
                  value={formData.synteticky_ucet}
                  onChange={(e) => setFormData((prev) => ({ ...prev, synteticky_ucet: e.target.value }))}
                  disabled={!!editingId}
                />
              </div>
              <div>
                <Label htmlFor="analyticky_ucet">Analyticky ucet</Label>
                <Input
                  id="analyticky_ucet"
                  placeholder="napr. 100"
                  maxLength={10}
                  value={formData.analyticky_ucet}
                  onChange={(e) => setFormData((prev) => ({ ...prev, analyticky_ucet: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="nazov">Nazov uctu *</Label>
                <Input
                  id="nazov"
                  placeholder="Nazov uctu"
                  value={formData.nazov}
                  onChange={(e) => setFormData((prev) => ({ ...prev, nazov: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="typ">Typ uctu</Label>
                <select
                  id="typ"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.typ}
                  onChange={(e) => setFormData((prev) => ({ ...prev, typ: e.target.value as FormData["typ"] }))}
                >
                  <option value="aktivny">Aktivny</option>
                  <option value="pasivny">Pasivny</option>
                  <option value="vynosovy">Vynosovy</option>
                  <option value="nakladovy">Nakladovy</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-6 mt-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={formData.danovy}
                  onChange={(e) => setFormData((prev) => ({ ...prev, danovy: e.target.checked }))}
                />
                Danovy ucet
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={formData.podsuvahovovy}
                  onChange={(e) => setFormData((prev) => ({ ...prev, podsuvahovovy: e.target.checked }))}
                />
                Podsuvahovy ucet
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={formData.aktivny}
                  onChange={(e) => setFormData((prev) => ({ ...prev, aktivny: e.target.checked }))}
                />
                Aktivny
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {editingId ? "Ulozit zmeny" : "Vytvorit ucet"}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Zrusit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtre */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Hladat podla cisla alebo nazvu uctu..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
          />
        </div>
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={typFilter}
          onChange={(e) => {
            setTypFilter(e.target.value)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
        >
          {typOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={triedaFilter}
          onChange={(e) => {
            setTriedaFilter(e.target.value)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
        >
          {triedaOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Tabulka */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Ucet</th>
                  <th className="h-10 px-4 text-left font-medium">Analyticky</th>
                  <th className="h-10 px-4 text-left font-medium">Nazov</th>
                  <th className="h-10 px-4 text-left font-medium">Typ</th>
                  <th className="h-10 px-4 text-center font-medium">Danovy</th>
                  <th className="h-10 px-4 text-center font-medium">Aktivny</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Nacitavam...
                    </td>
                  </tr>
                ) : accounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      <div>
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Ziadne ucty v uctovnom rozvrhu.</p>
                        <button
                          onClick={handleSeed}
                          className="text-primary hover:underline text-sm"
                        >
                          Naplnit standardne slovenske ucty
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  accounts.map((account) => (
                    <tr key={account.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium">
                        {account.synteticky_ucet}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {account.analyticky_ucet || "-"}
                      </td>
                      <td className="px-4 py-3">{account.nazov}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typColors[account.typ] || ""}`}>
                          {typLabels[account.typ] || account.typ}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {account.danovy ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {account.aktivny ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            Ano
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Nie
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setMenuOpen(menuOpen === account.id ? null : account.id)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {menuOpen === account.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
                                <button
                                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                  onClick={() => handleEdit(account)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Upravit
                                </button>
                                <button
                                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                  onClick={() => handleDelete(account.id)}
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
                {pagination.total} uctov celkovo
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

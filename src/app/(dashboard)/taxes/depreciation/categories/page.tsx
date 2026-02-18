"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  FolderOpen,
  ArrowLeft,
} from "lucide-react"
import { getUsefulLife, DEPRECIATION_GROUPS } from "@/lib/tax/depreciation-calculator"

interface AssetCategory {
  id: string
  name: string
  depreciation_group: number
  useful_life: number | null
  depreciation_method: string
}

export default function AssetCategoriesPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  const emptyForm = {
    name: "",
    depreciation_group: 1,
    useful_life: null as number | null,
    depreciation_method: "rovnomerne",
  }

  const [form, setForm] = useState(emptyForm)

  const fetchCategories = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/asset-categories?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setCategories(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat kategorie" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleFormChange = (field: string, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCreate = async () => {
    if (!activeCompanyId || !form.name.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Nazov kategorie je povinny" })
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/asset-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          useful_life: form.useful_life || getUsefulLife(form.depreciation_group),
          company_id: activeCompanyId,
        }),
      })

      if (res.ok) {
        toast({ title: "Kategoria vytvorena" })
        setForm(emptyForm)
        setShowNewForm(false)
        fetchCategories()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vytvorit kategoriu" })
    } finally {
      setSaving(false)
    }
  }

  const handleStartEdit = (category: AssetCategory) => {
    setEditingId(category.id)
    setForm({
      name: category.name,
      depreciation_group: category.depreciation_group,
      useful_life: category.useful_life,
      depreciation_method: category.depreciation_method,
    })
    setShowNewForm(false)
  }

  const handleUpdate = async () => {
    if (!editingId || !form.name.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Nazov kategorie je povinny" })
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/asset-categories/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          useful_life: form.useful_life || getUsefulLife(form.depreciation_group),
        }),
      })

      if (res.ok) {
        toast({ title: "Kategoria aktualizovana" })
        setEditingId(null)
        setForm(emptyForm)
        fetchCategories()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa aktualizovat kategoriu" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tuto kategoriu?")) return

    try {
      const res = await fetch(`/api/asset-categories/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Kategoria odstranena" })
        fetchCategories()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit kategoriu" })
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setShowNewForm(false)
    setForm(emptyForm)
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/taxes/depreciation">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kategorie majetku</h1>
            <p className="text-muted-foreground">Sprava kategorii pre zaradovanie majetku</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setShowNewForm(true)
            setEditingId(null)
            setForm(emptyForm)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova kategoria
        </Button>
      </div>

      {/* New category inline form */}
      {showNewForm && (
        <Card className="mb-6 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nova kategoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Nazov *</Label>
                <Input
                  placeholder="napr. Kancelarska technika"
                  value={form.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Odpisova skupina</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.depreciation_group}
                  onChange={(e) => {
                    const group = parseInt(e.target.value)
                    handleFormChange("depreciation_group", group)
                    handleFormChange("useful_life", getUsefulLife(group))
                  }}
                >
                  {Object.entries(DEPRECIATION_GROUPS).map(([g, info]) => (
                    <option key={g} value={g}>Sk. {g} ({info.useful_life} r.)</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Doba odpisovania (roky)</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.useful_life || getUsefulLife(form.depreciation_group)}
                  onChange={(e) => handleFormChange("useful_life", parseInt(e.target.value) || null)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Metoda</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.depreciation_method}
                  onChange={(e) => handleFormChange("depreciation_method", e.target.value)}
                >
                  <option value="rovnomerne">Rovnomerne</option>
                  <option value="zrychlene">Zrychlene</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={saving} size="sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" onClick={handleCancel} size="sm">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Nazov</th>
                  <th className="h-10 px-4 text-center font-medium">Odpisova skupina</th>
                  <th className="h-10 px-4 text-center font-medium">Doba odpisovania</th>
                  <th className="h-10 px-4 text-center font-medium">Metoda</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center text-muted-foreground">
                      Nacitavam...
                    </td>
                  </tr>
                ) : categories.length === 0 && !showNewForm ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center text-muted-foreground">
                      <div>
                        <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatial nemate ziadne kategorie majetku.</p>
                        <button
                          className="text-primary hover:underline text-sm mt-1"
                          onClick={() => {
                            setShowNewForm(true)
                            setForm(emptyForm)
                          }}
                        >
                          Vytvorit prvu kategoriu
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  categories.map((category) => {
                    const isEditing = editingId === category.id

                    if (isEditing) {
                      return (
                        <tr key={category.id} className="border-b bg-primary/5">
                          <td className="px-4 py-2">
                            <Input
                              value={form.name}
                              onChange={(e) => handleFormChange("name", e.target.value)}
                              className="h-8"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                              value={form.depreciation_group}
                              onChange={(e) => {
                                const group = parseInt(e.target.value)
                                handleFormChange("depreciation_group", group)
                                handleFormChange("useful_life", getUsefulLife(group))
                              }}
                            >
                              {Object.entries(DEPRECIATION_GROUPS).map(([g, info]) => (
                                <option key={g} value={g}>Sk. {g} ({info.useful_life} r.)</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              min="1"
                              className="h-8 text-center"
                              value={form.useful_life || getUsefulLife(form.depreciation_group)}
                              onChange={(e) => handleFormChange("useful_life", parseInt(e.target.value) || null)}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                              value={form.depreciation_method}
                              onChange={(e) => handleFormChange("depreciation_method", e.target.value)}
                            >
                              <option value="rovnomerne">Rovnomerne</option>
                              <option value="zrychlene">Zrychlene</option>
                            </select>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button onClick={handleUpdate} disabled={saving} size="sm" variant="ghost">
                                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                              </Button>
                              <Button variant="ghost" onClick={handleCancel} size="sm">
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={category.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{category.name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            Skupina {category.depreciation_group}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {category.useful_life || getUsefulLife(category.depreciation_group)} rokov
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            category.depreciation_method === "zrychlene"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                              : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          }`}>
                            {category.depreciation_method === "zrychlene" ? "Zrychlene" : "Rovnomerne"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartEdit(category)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(category.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

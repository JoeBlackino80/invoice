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
  FolderKanban,
  Loader2,
} from "lucide-react"

interface Project {
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

export default function ProjectsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchProjects = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "50",
      })
      if (search) params.set("search", search)

      const res = await fetch(`/api/projects?${params}`)
      const json = await res.json()

      if (res.ok) {
        setProjects(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa nacitat projekty" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat projekty" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, search, pagination.page, toast])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleCreate = () => {
    setFormData(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  const handleEdit = (project: Project) => {
    setFormData({
      code: project.code,
      name: project.name,
      description: project.description || "",
      active: project.active,
    })
    setEditingId(project.id)
    setShowForm(true)
    setMenuOpen(null)
  }

  const handleSave = async () => {
    if (!activeCompanyId) return
    if (!formData.code.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Kod projektu je povinny" })
      return
    }
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Nazov projektu je povinny" })
      return
    }

    setSaving(true)
    try {
      const url = editingId
        ? `/api/projects/${editingId}`
        : "/api/projects"
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
        toast({ title: editingId ? "Projekt aktualizovany" : "Projekt vytvoreny" })
        setShowForm(false)
        setEditingId(null)
        setFormData(emptyForm)
        fetchProjects()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa ulozit projekt" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit projekt" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tento projekt?")) return

    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Projekt odstraneny" })
        fetchProjects()
      } else {
        const json = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa odstranit projekt" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit projekt" })
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
          <h1 className="text-3xl font-bold tracking-tight">Zakazky / Projekty</h1>
          <p className="text-muted-foreground">Sledovanie nakladov a vynosov podla zakazok</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novy projekt
        </Button>
      </div>

      {/* Formular pre vytvorenie/upravu */}
      {showForm && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingId ? "Upravit projekt" : "Novy projekt"}
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
                  placeholder="napr. P001"
                  value={formData.code}
                  onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="name">Nazov *</Label>
                <Input
                  id="name"
                  placeholder="Nazov projektu"
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
                  Aktivny
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
                {editingId ? "Ulozit zmeny" : "Vytvorit projekt"}
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
                ) : projects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center text-muted-foreground">
                      <div>
                        <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatial nemate ziadne projekty.</p>
                        <button
                          onClick={handleCreate}
                          className="text-primary hover:underline text-sm"
                        >
                          Vytvorit prvy projekt
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  projects.map((project) => (
                    <tr key={project.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium">{project.code}</td>
                      <td className="px-4 py-3">{project.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{project.description || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        {project.active ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            Aktivny
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Neaktivny
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setMenuOpen(menuOpen === project.id ? null : project.id)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {menuOpen === project.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
                                <button
                                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                  onClick={() => handleEdit(project)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Upravit
                                </button>
                                <button
                                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                  onClick={() => handleDelete(project.id)}
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
                {pagination.total} projektov celkovo
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

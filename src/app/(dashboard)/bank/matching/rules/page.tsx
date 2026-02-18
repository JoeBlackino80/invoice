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
  Trash2,
  Pencil,
  X,
  Check,
  Settings,
  Loader2,
} from "lucide-react"

interface MatchingRule {
  id: string
  name: string
  condition_type: "text" | "iban" | "vs"
  condition_value: string
  debit_account: string
  credit_account: string
  description: string | null
  created_at: string
}

interface RuleFormData {
  name: string
  condition_type: "text" | "iban" | "vs"
  condition_value: string
  debit_account: string
  credit_account: string
  description: string
}

const emptyForm: RuleFormData = {
  name: "",
  condition_type: "text",
  condition_value: "",
  debit_account: "",
  credit_account: "",
  description: "",
}

const conditionTypeLabels: Record<string, string> = {
  text: "Text",
  iban: "IBAN",
  vs: "Variabilny symbol",
}

export default function MatchingRulesPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [rules, setRules] = useState<MatchingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RuleFormData>(emptyForm)

  const fetchRules = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/bank-matching-rules?company_id=${activeCompanyId}&limit=100`)
      const json = await res.json()
      if (res.ok) {
        setRules(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat pravidla" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const handleCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  const handleEdit = (rule: MatchingRule) => {
    setForm({
      name: rule.name,
      condition_type: rule.condition_type,
      condition_value: rule.condition_value,
      debit_account: rule.debit_account,
      credit_account: rule.credit_account,
      description: rule.description || "",
    })
    setEditingId(rule.id)
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleSave = async () => {
    if (!activeCompanyId) return
    if (!form.name || !form.condition_value || !form.debit_account || !form.credit_account) {
      toast({ variant: "destructive", title: "Chyba", description: "Vyplnte vsetky povinne polia" })
      return
    }

    setSaving(true)
    try {
      let res: Response

      if (editingId) {
        // Update
        res = await fetch(`/api/bank-matching-rules/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
      } else {
        // Create
        res = await fetch("/api/bank-matching-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: activeCompanyId,
            ...form,
          }),
        })
      }

      if (res.ok) {
        toast({ title: editingId ? "Pravidlo aktualizovane" : "Pravidlo vytvorene" })
        handleCancel()
        fetchRules()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit pravidlo" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit toto pravidlo?")) return
    try {
      const res = await fetch(`/api/bank-matching-rules/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Pravidlo odstranene" })
        fetchRules()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit pravidlo" })
    }
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pravidla parovania</h1>
          <p className="text-muted-foreground">Sprava pravidiel pre automaticke parovanie bankovych transakcii</p>
        </div>
        <div className="flex gap-2">
          <Link href="/bank/matching">
            <Button variant="outline">
              Spat na parovanie
            </Button>
          </Link>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nove pravidlo
          </Button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? "Upravit pravidlo" : "Nove pravidlo"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nazov *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Napr. Platba za telefon"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition_type">Typ podmienky *</Label>
                <select
                  id="condition_type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.condition_type}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, condition_type: e.target.value as "text" | "iban" | "vs" }))
                  }
                >
                  <option value="text">Text (v popise)</option>
                  <option value="iban">IBAN</option>
                  <option value="vs">Variabilny symbol</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition_value">Hodnota podmienky *</Label>
                <Input
                  id="condition_value"
                  value={form.condition_value}
                  onChange={(e) => setForm((prev) => ({ ...prev, condition_value: e.target.value }))}
                  placeholder={
                    form.condition_type === "iban"
                      ? "SK1234567890123456"
                      : form.condition_type === "vs"
                      ? "1234567890"
                      : "Hladany text"
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="debit_account">MD ucet *</Label>
                <Input
                  id="debit_account"
                  value={form.debit_account}
                  onChange={(e) => setForm((prev) => ({ ...prev, debit_account: e.target.value }))}
                  placeholder="Napr. 221"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="credit_account">D ucet *</Label>
                <Input
                  id="credit_account"
                  value={form.credit_account}
                  onChange={(e) => setForm((prev) => ({ ...prev, credit_account: e.target.value }))}
                  placeholder="Napr. 311"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Popis</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Volitelny popis pravidla"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {editingId ? "Ulozit zmeny" : "Vytvorit pravidlo"}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <X className="mr-2 h-4 w-4" />
                Zrusit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Nazov</th>
                  <th className="h-10 px-4 text-left font-medium">Typ podmienky</th>
                  <th className="h-10 px-4 text-left font-medium">Hodnota</th>
                  <th className="h-10 px-4 text-left font-medium">MD ucet</th>
                  <th className="h-10 px-4 text-left font-medium">D ucet</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      Nacitavam...
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      <div>
                        <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatial nemate ziadne pravidla parovania.</p>
                        <button
                          onClick={handleCreate}
                          className="text-primary hover:underline text-sm"
                        >
                          Vytvorit prve pravidlo
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium">{rule.name}</span>
                          {rule.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {conditionTypeLabels[rule.condition_type] || rule.condition_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate">
                        {rule.condition_value}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-blue-600">{rule.debit_account}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-orange-600">{rule.credit_account}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(rule)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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

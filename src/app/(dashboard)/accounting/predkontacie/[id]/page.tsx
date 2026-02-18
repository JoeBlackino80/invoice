"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Loader2,
} from "lucide-react"

interface PredkontaciaLine {
  account_synteticky: string
  account_analyticky: string
  side: "MD" | "D"
  is_amount_field: boolean
  fixed_amount: number | undefined
  percentage: number | undefined
  description: string
}

interface Predkontacia {
  id: string
  name: string
  document_type: string
  description: string | null
  lines: PredkontaciaLine[]
}

const documentTypes = [
  { value: "FA", label: "FA - Faktura vydana" },
  { value: "PFA", label: "PFA - Prijata faktura" },
  { value: "ID", label: "ID - Interny doklad" },
  { value: "BV", label: "BV - Bankovy vypis" },
  { value: "PPD", label: "PPD - Prijmovy pokl. doklad" },
  { value: "VPD", label: "VPD - Vydavkovy pokl. doklad" },
]

function createEmptyLine(): PredkontaciaLine {
  return {
    account_synteticky: "",
    account_analyticky: "",
    side: "MD",
    is_amount_field: true,
    fixed_amount: undefined,
    percentage: undefined,
    description: "",
  }
}

export default function EditPredkontaciaPage() {
  const params = useParams()
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [documentType, setDocumentType] = useState("ID")
  const [description, setDescription] = useState("")
  const [lines, setLines] = useState<PredkontaciaLine[]>([])
  const [saving, setSaving] = useState(false)

  const fetchPredkontacia = useCallback(async () => {
    try {
      const res = await fetch(`/api/predkontacie/${params.id}`)
      if (res.ok) {
        const data: Predkontacia = await res.json()
        setName(data.name)
        setDocumentType(data.document_type)
        setDescription(data.description || "")

        const mappedLines: PredkontaciaLine[] = (data.lines || []).map((l: any) => ({
          account_synteticky: l.account_synteticky || "",
          account_analyticky: l.account_analyticky || "",
          side: l.side || "MD",
          is_amount_field: l.is_amount_field !== false,
          fixed_amount: l.fixed_amount,
          percentage: l.percentage,
          description: l.description || "",
        }))

        setLines(mappedLines.length > 0 ? mappedLines : [createEmptyLine()])
      } else {
        toast({ variant: "destructive", title: "Chyba", description: "Predkontacia nebola najdena" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat predkontaciu" })
    } finally {
      setLoading(false)
    }
  }, [params.id, toast])

  useEffect(() => {
    fetchPredkontacia()
  }, [fetchPredkontacia])

  const updateLine = (index: number, field: keyof PredkontaciaLine, value: any) => {
    setLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeLine = (index: number) => {
    if (lines.length <= 1) return
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()])
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Nazov je povinny" })
      return
    }

    const validLines = lines.filter((l) => l.account_synteticky.length >= 3)
    if (validLines.length === 0) {
      toast({ variant: "destructive", title: "Chyba", description: "Pridajte aspon jeden riadok s platnym syntetickym uctom" })
      return
    }

    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        document_type: documentType,
        description: description.trim() || undefined,
        lines: validLines.map((l) => ({
          account_synteticky: l.account_synteticky,
          account_analyticky: l.account_analyticky || undefined,
          side: l.side,
          is_amount_field: l.is_amount_field,
          fixed_amount: l.fixed_amount,
          percentage: l.percentage,
          description: l.description || undefined,
        })),
      }

      const res = await fetch(`/api/predkontacie/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast({ title: "Predkontacia ulozena" })
        router.push("/accounting/predkontacie")
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa ulozit" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit predkontaciu" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upravit predkontaciu</h1>
          <p className="text-muted-foreground">{name}</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/accounting/predkontacie")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Spat
        </Button>
      </div>

      {/* Header form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Zakladne udaje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nazov predkontacie</label>
              <Input
                placeholder="Napr. Nakup materialu..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Typ dokladu</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                {documentTypes.map((dt) => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Popis</label>
              <Input
                placeholder="Volitelny popis..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lines table */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Riadky predkontacie</CardTitle>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="mr-1 h-4 w-4" />
              Pridat riadok
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-3 text-left font-medium w-28">Synt. ucet</th>
                  <th className="h-10 px-3 text-left font-medium w-28">Anal. ucet</th>
                  <th className="h-10 px-3 text-center font-medium w-24">Strana</th>
                  <th className="h-10 px-3 text-center font-medium w-32">Typ sumy</th>
                  <th className="h-10 px-3 text-right font-medium w-28">Fixna suma</th>
                  <th className="h-10 px-3 text-right font-medium w-28">Percento (%)</th>
                  <th className="h-10 px-3 text-left font-medium">Popis</th>
                  <th className="h-10 px-3 text-center font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className="border-b">
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 text-sm font-mono"
                        placeholder="501"
                        maxLength={3}
                        value={line.account_synteticky}
                        onChange={(e) => updateLine(index, "account_synteticky", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 text-sm font-mono"
                        placeholder="100"
                        value={line.account_analyticky}
                        onChange={(e) => updateLine(index, "account_analyticky", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            line.side === "MD"
                              ? "bg-blue-600 text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          onClick={() => updateLine(index, "side", "MD")}
                        >
                          MD
                        </button>
                        <button
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            line.side === "D"
                              ? "bg-orange-600 text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          onClick={() => updateLine(index, "side", "D")}
                        >
                          D
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            line.is_amount_field
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          onClick={() => updateLine(index, "is_amount_field", true)}
                        >
                          Z dokladu
                        </button>
                        <button
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            !line.is_amount_field
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          onClick={() => updateLine(index, "is_amount_field", false)}
                        >
                          Fixna
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-sm text-right"
                        placeholder="0.00"
                        value={line.fixed_amount ?? ""}
                        onChange={(e) => updateLine(index, "fixed_amount", e.target.value ? parseFloat(e.target.value) : undefined)}
                        disabled={line.is_amount_field}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-sm text-right"
                        placeholder="100"
                        value={line.percentage ?? ""}
                        onChange={(e) => updateLine(index, "percentage", e.target.value ? parseFloat(e.target.value) : undefined)}
                        disabled={!line.is_amount_field}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 text-sm"
                        placeholder="Popis riadku..."
                        value={line.description}
                        onChange={(e) => updateLine(index, "description", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(index)}
                        disabled={lines.length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Preview */}
          <div className="mt-4 border-t pt-4">
            <p className="text-sm font-medium mb-2">Nahlad kontacie:</p>
            <div className="font-mono text-sm">
              <span className="text-blue-600">
                {lines.filter((l) => l.side === "MD" && l.account_synteticky).map((l) => l.account_synteticky).join(" + ") || "..."}
              </span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-orange-600">
                {lines.filter((l) => l.side === "D" && l.account_synteticky).map((l) => l.account_synteticky).join(" + ") || "..."}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/accounting/predkontacie")} disabled={saving}>
          Zrusit
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Ukladam..." : "Ulozit zmeny"}
        </Button>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface NumberingSeries {
  id: string
  document_type: string
  prefix: string
  suffix: string
  next_number: number
  padding: number
  separator: string
}

const documentTypeLabels: Record<string, string> = {
  vydana_faktura: "Vydana faktura",
  prijata_faktura: "Prijata faktura",
  dobropis: "Dobropis",
  zalohova: "Zalohova faktura",
  pokladnicny_doklad: "Pokladnicny doklad",
  ucetny_doklad: "Ucetny doklad",
  objednavka: "Objednavka",
  cenova_ponuka: "Cenova ponuka",
  dodaci_list: "Dodaci list",
}

const defaultSeries: Array<Omit<NumberingSeries, "id">> = [
  { document_type: "vydana_faktura", prefix: "FA", suffix: "", next_number: 1, padding: 4, separator: "" },
  { document_type: "prijata_faktura", prefix: "PF", suffix: "", next_number: 1, padding: 4, separator: "" },
  { document_type: "dobropis", prefix: "DB", suffix: "", next_number: 1, padding: 4, separator: "" },
  { document_type: "zalohova", prefix: "ZF", suffix: "", next_number: 1, padding: 4, separator: "" },
  { document_type: "pokladnicny_doklad", prefix: "PD", suffix: "", next_number: 1, padding: 4, separator: "" },
  { document_type: "ucetny_doklad", prefix: "UD", suffix: "", next_number: 1, padding: 4, separator: "" },
  { document_type: "objednavka", prefix: "OB", suffix: "", next_number: 1, padding: 4, separator: "" },
  { document_type: "cenova_ponuka", prefix: "CP", suffix: "", next_number: 1, padding: 4, separator: "" },
  { document_type: "dodaci_list", prefix: "DL", suffix: "", next_number: 1, padding: 4, separator: "" },
]

function generatePreview(series: Omit<NumberingSeries, "id"> & { id?: string }): string {
  const num = String(series.next_number).padStart(series.padding, "0")
  const yearStr = new Date().getFullYear().toString()
  const parts = [series.prefix, yearStr, num]
  const joined = parts.join(series.separator || "")
  return series.suffix ? `${joined}${series.suffix}` : joined
}

export default function NumberingPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [series, setSeries] = useState<NumberingSeries[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editedRows, setEditedRows] = useState<Record<string, Partial<NumberingSeries>>>({})

  const fetchNumbering = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/settings/numbering?company_id=${activeCompanyId}`)
      if (res.ok) {
        const data = await res.json()
        setSeries(data)
      }
    } catch {
      toast({ title: "Chyba pri nacitani cislovania", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchNumbering()
  }, [fetchNumbering])

  // Merge fetched data with defaults for missing types
  const mergedSeries = defaultSeries.map((def) => {
    const existing = series.find((s) => s.document_type === def.document_type)
    if (existing) {
      return existing
    }
    return { ...def, id: `new_${def.document_type}` }
  })

  const getEditedValue = (id: string, field: keyof NumberingSeries, original: any) => {
    const edited = editedRows[id]
    if (edited && field in edited) {
      return edited[field]
    }
    return original
  }

  const handleEdit = (id: string, field: keyof NumberingSeries, value: string | number) => {
    setEditedRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  const handleSave = async () => {
    if (!activeCompanyId) return
    setSaving(true)

    try {
      const editedIds = Object.keys(editedRows)
      for (const id of editedIds) {
        const original = mergedSeries.find(
          (s) => s.id === id || `new_${s.document_type}` === id
        )
        if (!original) continue

        const edited = editedRows[id]
        const isNew = id.startsWith("new_")

        const payload = {
          id: isNew ? undefined : id,
          company_id: activeCompanyId,
          document_type: original.document_type,
          prefix: (edited.prefix !== undefined ? edited.prefix : original.prefix) as string,
          suffix: (edited.suffix !== undefined ? edited.suffix : original.suffix) as string,
          next_number: Number(edited.next_number !== undefined ? edited.next_number : original.next_number),
          padding: Number(edited.padding !== undefined ? edited.padding : original.padding),
          separator: (edited.separator !== undefined ? edited.separator : original.separator) as string,
        }

        const res = await fetch("/api/settings/numbering", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const err = await res.json()
          toast({
            title: `Chyba pri ukladani ${documentTypeLabels[original.document_type]}`,
            description: err.error?.toString(),
            variant: "destructive",
          })
          setSaving(false)
          return
        }
      }

      toast({ title: "Cislovanie bolo ulozene" })
      setEditedRows({})
      fetchNumbering()
    } catch {
      toast({ title: "Chyba pri ukladani", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Nacitavam...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cislovanie dokladov</h1>
          <p className="text-muted-foreground">
            Nastavte predpony, format a cislovanie pre kazdy typ dokladu
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || Object.keys(editedRows).length === 0}
        >
          {saving ? "Ukladam..." : "Ulozit zmeny"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Konfiguracia cislovania</CardTitle>
          <CardDescription>
            Upozornenie: Slovenska legislativa vyzaduje suvislu ciselnu radu bez medzier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ dokladu</TableHead>
                <TableHead>Predpona</TableHead>
                <TableHead>Oddelovac</TableHead>
                <TableHead>Dalsie cislo</TableHead>
                <TableHead>Vypln (cislice)</TableHead>
                <TableHead>Ukazka</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mergedSeries.map((s) => {
                const rowId = s.id
                const prefix = getEditedValue(rowId, "prefix", s.prefix) as string
                const separator = getEditedValue(rowId, "separator", s.separator) as string
                const nextNumber = getEditedValue(rowId, "next_number", s.next_number) as number
                const padding = getEditedValue(rowId, "padding", s.padding) as number
                const suffix = getEditedValue(rowId, "suffix", s.suffix) as string

                const preview = generatePreview({
                  document_type: s.document_type,
                  prefix,
                  suffix,
                  next_number: nextNumber,
                  padding,
                  separator,
                })

                return (
                  <TableRow key={rowId}>
                    <TableCell className="font-medium">
                      {documentTypeLabels[s.document_type] || s.document_type}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={prefix}
                        onChange={(e) => handleEdit(rowId, "prefix", e.target.value)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={separator}
                        onChange={(e) => handleEdit(rowId, "separator", e.target.value)}
                        className="w-16"
                        placeholder="-"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={nextNumber}
                        onChange={(e) =>
                          handleEdit(rowId, "next_number", parseInt(e.target.value) || 1)
                        }
                        className="w-24"
                        min={1}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={padding}
                        onChange={(e) =>
                          handleEdit(rowId, "padding", parseInt(e.target.value) || 1)
                        }
                        className="w-20"
                        min={1}
                        max={10}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {preview}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-800">
              <span className="text-sm font-bold">!</span>
            </div>
            <div>
              <p className="font-medium">Upozornenie k cislovaniu</p>
              <p className="text-sm text-muted-foreground">
                Podla slovenskej legislativy musia byt doklady cislovane postupne bez medzier v ciselnej rade.
                Zmena cislovania pocas fiskalneho roka moze sposobit problemy pri danovej kontrole.
                Odporucame menit cislovanie len na zaciatku noveho fiskalneho roka.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

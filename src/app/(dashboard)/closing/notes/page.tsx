"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  Loader2,
  FileText,
  Save,
  RefreshCw,
  CheckCircle2,
  Edit3,
  Eye,
} from "lucide-react"

// ---- Types ----

interface NotesSection {
  id: string
  title: string
  content: string
  order: number
  editable: boolean
}

interface NotesData {
  sections: NotesSection[]
  fiscal_year: string
  generated_at: string
  company_name: string
}

interface FiscalYear {
  id: string
  year: number
  start_date: string
  end_date: string
}

// ---- Main Page ----

export default function NotesPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [notes, setNotes] = useState<NotesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>("")
  const [loadingFy, setLoadingFy] = useState(true)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editContent, setEditContent] = useState<string>("")

  // Fetch fiscal years
  const fetchFiscalYears = useCallback(async () => {
    if (!activeCompanyId) return
    setLoadingFy(true)

    try {
      const res = await fetch(`/api/settings/fiscal-years?company_id=${activeCompanyId}`)
      if (res.ok) {
        const fyData = await res.json()
        if (fyData && fyData.length > 0) {
          setFiscalYears(fyData)
          setSelectedFiscalYear(fyData[0].id)
        }
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingFy(false)
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchFiscalYears()
  }, [fetchFiscalYears])

  // Fetch existing notes
  const fetchNotes = useCallback(async () => {
    if (!activeCompanyId || !selectedFiscalYear) return
    setLoading(true)

    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        fiscal_year_id: selectedFiscalYear,
      })

      const res = await fetch(`/api/closing/notes?${params}`)
      const json = await res.json()

      if (res.ok && json.data && json.data.sections) {
        setNotes(json.data)
      } else {
        setNotes(null)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedFiscalYear])

  useEffect(() => {
    if (selectedFiscalYear) {
      fetchNotes()
    }
  }, [selectedFiscalYear, fetchNotes])

  // Generate notes
  const handleGenerate = async () => {
    if (!activeCompanyId || !selectedFiscalYear) return
    setGenerating(true)

    try {
      const res = await fetch("/api/closing/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          fiscal_year_id: selectedFiscalYear,
          action: "generate",
        }),
      })

      const json = await res.json()

      if (res.ok && json.data) {
        setNotes(json.data)
        toast({
          title: "Poznamky vygenerovane",
          description: "Poznamky k uctovnej zavierke boli uspesne vygenerovane",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: json.error || "Nepodarilo sa generovat poznamky",
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa generovat poznamky",
      })
    } finally {
      setGenerating(false)
    }
  }

  // Save notes
  const handleSave = async () => {
    if (!activeCompanyId || !selectedFiscalYear || !notes) return
    setSaving(true)

    try {
      const res = await fetch("/api/closing/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          fiscal_year_id: selectedFiscalYear,
          action: "save",
          sections: notes.sections,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        toast({
          title: "Ulozene",
          description: "Poznamky boli uspesne ulozene",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: json.error || "Nepodarilo sa ulozit poznamky",
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa ulozit poznamky",
      })
    } finally {
      setSaving(false)
    }
  }

  // Edit section
  const startEditing = (section: NotesSection) => {
    setEditingSection(section.id)
    setEditContent(section.content)
  }

  const cancelEditing = () => {
    setEditingSection(null)
    setEditContent("")
  }

  const saveSection = (sectionId: string) => {
    if (!notes) return

    const updatedSections = notes.sections.map((s) =>
      s.id === sectionId ? { ...s, content: editContent } : s
    )

    setNotes({ ...notes, sections: updatedSections })
    setEditingSection(null)
    setEditContent("")
  }

  return (
    <div>
      <Breadcrumb />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Poznamky k uctovnej zavierke</h1>
          <p className="text-muted-foreground">
            Poznamky k uctovnej zavierke podla slovenskych uctovnych standardov
          </p>
        </div>
        <div className="flex items-center gap-2">
          {notes && (
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ukladam...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Ulozit
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Fiscal year selector + Generate button */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Uctovne obdobie</label>
              {loadingFy ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Nacitavam...
                </div>
              ) : fiscalYears.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ziadne uctovne obdobia. Najprv vytvorte uctovne obdobie.
                </p>
              ) : (
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm min-w-[200px]"
                  value={selectedFiscalYear}
                  onChange={(e) => setSelectedFiscalYear(e.target.value)}
                >
                  {fiscalYears.map((fy) => (
                    <option key={fy.id} value={fy.id}>
                      {fy.year} ({fy.start_date} - {fy.end_date})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedFiscalYear}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generujem...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generovat poznamky
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {(loading || generating) && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p>{generating ? "Generujem poznamky..." : "Nacitavam poznamky..."}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes sections */}
      {!loading && !generating && notes && (
        <div className="space-y-4">
          {notes.sections
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <Card key={section.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                    <div className="flex items-center gap-1">
                      {editingSection === section.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => saveSection(section.id)}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Potvrdit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEditing}
                          >
                            Zrusit
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(section)}
                          >
                            <Edit3 className="mr-1 h-4 w-4" />
                            Upravit
                          </Button>
                          <Button variant="ghost" size="sm" disabled>
                            <Eye className="mr-1 h-4 w-4" />
                            Nahla&apos;d
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingSection === section.id ? (
                    <textarea
                      className="w-full min-h-[300px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                  ) : (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />
                  )}
                </CardContent>
              </Card>
            ))}

          {/* Meta info */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Spolocnost: {notes.company_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Uctovne obdobie: {notes.fiscal_year}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vygenerovane:{" "}
                    {new Date(notes.generated_at).toLocaleString("sk-SK")}
                  </p>
                </div>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Ukladam...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Ulozit poznamky
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state */}
      {!loading && !generating && !notes && selectedFiscalYear && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-1">
                Poznamky este neboli vygenerovane
              </p>
              <p className="text-sm mb-4">
                Kliknite na &quot;Generovat poznamky&quot; pre automaticke vygenerovanie
                poznamok k uctovnej zavierke.
              </p>
              <Button onClick={handleGenerate} disabled={generating}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Generovat poznamky
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

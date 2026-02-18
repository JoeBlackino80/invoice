"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  FileDown,
  Loader2,
} from "lucide-react"

interface Document {
  id: string
  name: string
  type: string
  mime_type: string
  file_url: string
  ocr_status: string
  ocr_data: any | null
  created_at: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

export default function DocumentsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/documents?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setDocuments(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat dokumenty" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleUpload = async (file: File) => {
    if (!activeCompanyId) {
      toast({ variant: "destructive", title: "Chyba", description: "Nie je vybrana firma" })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("company_id", activeCompanyId)

      const uploadRes = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        throw new Error(err.error || "Chyba pri nahravani")
      }

      const uploadData = await uploadRes.json()
      toast({ title: "Dokument nahrany", description: file.name })

      // Trigger OCR processing
      const ocrRes = await fetch(`/api/documents/${uploadData.id}/ocr`, {
        method: "POST",
      })

      if (ocrRes.ok) {
        toast({ title: "OCR spustene", description: "Dokument sa spracovava..." })
      } else {
        toast({ variant: "destructive", title: "OCR chyba", description: "Nepodarilo sa spustit OCR spracovanie" })
      }

      fetchDocuments()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba pri nahravani", description: error.message })
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      const allowedTypes = ["image/jpeg", "image/png", "application/pdf", "image/webp"]
      if (allowedTypes.includes(file.type)) {
        handleUpload(file)
      } else {
        toast({ variant: "destructive", title: "Nepodporovany format", description: "Povolene formaty: JPEG, PNG, PDF, WebP" })
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tento dokument?")) return
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Dokument odstraneny" })
        fetchDocuments()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit dokument" })
    }
  }

  const handleCreateInvoice = async (doc: Document) => {
    if (doc.ocr_status !== "spracovane") {
      toast({ variant: "destructive", title: "OCR nie je dokoncene", description: "Najprv spustite OCR spracovanie dokumentu" })
      return
    }
    window.location.href = `/documents/${doc.id}`
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dokumenty</h1>
          <p className="text-muted-foreground">Nahravanie a OCR spracovanie dokladov</p>
        </div>
      </div>

      {/* Upload oblast */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,application/pdf,image/webp"
              onChange={handleFileSelect}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium">Nahrava sa...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Pretiahnite subor sem alebo kliknite pre vyber
                </p>
                <p className="text-xs text-muted-foreground">
                  Podporovane formaty: JPEG, PNG, PDF, WebP
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabulka dokumentov */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Nazov</th>
                  <th className="h-10 px-4 text-left font-medium">Typ</th>
                  <th className="h-10 px-4 text-left font-medium">Datum nahratia</th>
                  <th className="h-10 px-4 text-center font-medium">OCR stav</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                      Nacitavam...
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center text-muted-foreground">
                      <div>
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatial nemate ziadne dokumenty.</p>
                        <p className="text-xs mt-1">Nahrajte prvy dokument pomocou oblasti vyssie.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr key={doc.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {doc.mime_type === "application/pdf" ? "PDF" :
                         doc.mime_type === "image/jpeg" ? "JPEG" :
                         doc.mime_type === "image/png" ? "PNG" :
                         doc.mime_type === "image/webp" ? "WebP" :
                         doc.mime_type}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          doc.ocr_status === "spracovane"
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                        }`}>
                          {doc.ocr_status === "spracovane" ? "Spracovane" : "Nespracovane"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/documents/${doc.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Zobrazit OCR">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Vytvorit fakturu"
                            onClick={() => handleCreateInvoice(doc)}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            title="Odstranit"
                            onClick={() => handleDelete(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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

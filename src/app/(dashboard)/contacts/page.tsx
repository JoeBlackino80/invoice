"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  ExternalLink,
  Building2,
  User,
  Users,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Contact {
  id: string
  type: string
  name: string
  ico: string | null
  dic: string | null
  ic_dph: string | null
  email: string | null
  phone: string | null
  city: string | null
  tags: string[] | null
}

const typeLabels: Record<string, string> = {
  odberatel: "Odberateľ",
  dodavatel: "Dodávateľ",
  oba: "Oba",
}

const typeFilters = [
  { value: "vsetky", label: "Všetky", icon: Users },
  { value: "odberatel", label: "Odberatelia", icon: User },
  { value: "dodavatel", label: "Dodávatelia", icon: Building2 },
]

export default function ContactsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("vsetky")
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchContacts = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        type: typeFilter,
        page: pagination.page.toString(),
        limit: "25",
      })
      if (search) params.set("search", search)

      const res = await fetch(`/api/contacts?${params}`)
      const json = await res.json()

      if (res.ok) {
        setContacts(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať kontakty" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, typeFilter, search, pagination.page, toast])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstrániť tento kontakt?")) return
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Kontakt odstránený" })
      fetchContacts()
    } else {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstrániť kontakt" })
    }
    setMenuOpen(null)
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kontakty</h1>
          <p className="text-muted-foreground">Register odberateľov a dodávateľov</p>
        </div>
        <Link href="/contacts/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nový kontakt
          </Button>
        </Link>
      </div>

      {/* Filtre */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Hľadať podľa názvu, IČO, emailu..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {typeFilters.map((f) => (
            <Button
              key={f.value}
              variant={typeFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTypeFilter(f.value)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
            >
              <f.icon className="mr-1 h-4 w-4" />
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabuľka */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Názov</th>
                  <th className="h-10 px-4 text-left font-medium">Typ</th>
                  <th className="h-10 px-4 text-left font-medium">IČO</th>
                  <th className="h-10 px-4 text-left font-medium">IČ DPH</th>
                  <th className="h-10 px-4 text-left font-medium">Email</th>
                  <th className="h-10 px-4 text-left font-medium">Mesto</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      Načítavam...
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      <div>
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatiaľ nemáte žiadne kontakty.</p>
                        <Link href="/contacts/new" className="text-primary hover:underline text-sm">
                          Vytvoriť prvý kontakt
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr key={contact.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/contacts/${contact.id}`} className="font-medium hover:text-primary">
                          {contact.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          contact.type === "odberatel"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : contact.type === "dodavatel"
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                        }`}>
                          {typeLabels[contact.type] || contact.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{contact.ico || "–"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{contact.ic_dph || "–"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{contact.email || "–"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{contact.city || "–"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setMenuOpen(menuOpen === contact.id ? null : contact.id)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {menuOpen === contact.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
                                <Link
                                  href={`/contacts/${contact.id}/edit`}
                                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                  onClick={() => setMenuOpen(null)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Upraviť
                                </Link>
                                <button
                                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                  onClick={() => handleDelete(contact.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Odstrániť
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

          {/* Stránkovanie */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {pagination.total} kontaktov celkovo
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  Predchádzajúca
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  Ďalšia
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

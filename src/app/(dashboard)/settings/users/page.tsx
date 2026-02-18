"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface CompanyUser {
  id: string
  user_id: string
  email: string
  name: string
  role: string
  created_at: string
}

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  uctovnik: "Uctovnik",
  fakturant: "Fakturant",
  mzdar: "Mzdar",
  skladnik: "Skladnik",
  readonly: "Len na citanie",
}

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  uctovnik: "bg-blue-100 text-blue-800",
  fakturant: "bg-green-100 text-green-800",
  mzdar: "bg-purple-100 text-purple-800",
  skladnik: "bg-orange-100 text-orange-800",
  readonly: "bg-gray-100 text-gray-800",
}

const roleDescriptions: Array<{ role: string; label: string; description: string }> = [
  { role: "admin", label: "Administrator", description: "Plny pristup k vsetkym nastaveniam, pouzivatelom a datam. Moze menit nastavenia firmy a mazat data." },
  { role: "uctovnik", label: "Uctovnik", description: "Pristup k uctovnym dokladom, uzavierkam, danovym priznaniam. Moze vytararat a upravovat ucetne doklady." },
  { role: "fakturant", label: "Fakturant", description: "Pristup k fakturam, objednavkam a cenovym ponukam. Moze vytvartat a upravovat obchodne doklady." },
  { role: "mzdar", label: "Mzdar", description: "Pristup k mzdovej agende, zamestnancom a odvodom. Moze spracovavat mzdy." },
  { role: "skladnik", label: "Skladnik", description: "Pristup k skladovemu hospodarstvu, prijemkam a vydajkam. Moze spravovat sklad." },
  { role: "readonly", label: "Len na citanie", description: "Moze zobrazovat vsetky data bez moznosti uprav. Vhodne pre externalnych auditorov." },
]

export default function UsersPage() {
  const { activeCompanyId, isAdmin } = useCompany()
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [inviteForm, setInviteForm] = useState({ email: "", role: "readonly" })

  const fetchUsers = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/settings/users?company_id=${activeCompanyId}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch {
      toast({ title: "Chyba pri nacitani pouzivatelov", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleInvite = async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          user_email: inviteForm.email,
          role: inviteForm.role,
        }),
      })
      if (res.ok) {
        toast({ title: "Pouzivatel bol pridany" })
        setDialogOpen(false)
        setInviteForm({ email: "", role: "readonly" })
        fetchUsers()
      } else {
        const err = await res.json()
        toast({ title: "Chyba", description: err.error?.toString(), variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri pozyvani pouzivatela", variant: "destructive" })
    }
  }

  const handleRoleChange = async (id: string, newRole: string) => {
    if (!activeCompanyId) return
    try {
      const res = await fetch("/api/settings/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          company_id: activeCompanyId,
          role: newRole,
        }),
      })
      if (res.ok) {
        toast({ title: "Rola bola zmenena" })
        fetchUsers()
      } else {
        const err = await res.json()
        toast({ title: "Chyba", description: err.error?.toString(), variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri zmene roly", variant: "destructive" })
    }
  }

  const handleRemove = async (id: string) => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(
        `/api/settings/users?id=${id}&company_id=${activeCompanyId}`,
        { method: "DELETE" }
      )
      if (res.ok) {
        toast({ title: "Pouzivatel bol odstraneny" })
        setConfirmDelete(null)
        fetchUsers()
      } else {
        const err = await res.json()
        toast({ title: "Chyba", description: err.error?.toString(), variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri odstranovani pouzivatela", variant: "destructive" })
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
          <h1 className="text-3xl font-bold tracking-tight">Pouzivatelia a roly</h1>
          <p className="text-muted-foreground">
            Spravujte pouzivatelov a ich pristupove prava
          </p>
        </div>
        {isAdmin() && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Pozvat pouzivatela</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pozvat pouzivatela</DialogTitle>
                <DialogDescription>
                  Pridajte pouzivatela do firmy s vybranou rolou
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email pouzivatela</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="pouzivatel@firma.sk"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Rola</Label>
                  <Select
                    value={inviteForm.role}
                    onValueChange={(v) =>
                      setInviteForm((prev) => ({ ...prev, role: v }))
                    }
                  >
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="uctovnik">Uctovnik</SelectItem>
                      <SelectItem value="fakturant">Fakturant</SelectItem>
                      <SelectItem value="mzdar">Mzdar</SelectItem>
                      <SelectItem value="skladnik">Skladnik</SelectItem>
                      <SelectItem value="readonly">Len na citanie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Zrusit
                </Button>
                <Button onClick={handleInvite}>Pozvat</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zoznam pouzivatelov</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Ziadni pouzivatelia.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Meno</TableHead>
                  <TableHead>Rola</TableHead>
                  <TableHead>Pridany dna</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>{u.name || "-"}</TableCell>
                    <TableCell>
                      {isAdmin() && u.user_id !== currentUser?.id ? (
                        <Select
                          value={u.role}
                          onValueChange={(v) => handleRoleChange(u.id, v)}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrator</SelectItem>
                            <SelectItem value="uctovnik">Uctovnik</SelectItem>
                            <SelectItem value="fakturant">Fakturant</SelectItem>
                            <SelectItem value="mzdar">Mzdar</SelectItem>
                            <SelectItem value="skladnik">Skladnik</SelectItem>
                            <SelectItem value="readonly">Len na citanie</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          variant="secondary"
                          className={roleColors[u.role] || ""}
                        >
                          {roleLabels[u.role] || u.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("sk-SK")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin() && u.user_id !== currentUser?.id && (
                        <>
                          {confirmDelete === u.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-sm text-muted-foreground">
                                Naozaj odstranit?
                              </span>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRemove(u.id)}
                              >
                                Potvrdit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmDelete(null)}
                              >
                                Zrusit
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setConfirmDelete(u.id)}
                            >
                              Odstranit
                            </Button>
                          )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role descriptions card */}
      <Card>
        <CardHeader>
          <CardTitle>Popis roli</CardTitle>
          <CardDescription>
            Prehlad pristupovych prav pre jednotlive roly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {roleDescriptions.map((rd) => (
              <div key={rd.role} className="flex items-start gap-3">
                <Badge
                  variant="secondary"
                  className={`mt-0.5 shrink-0 ${roleColors[rd.role] || ""}`}
                >
                  {rd.label}
                </Badge>
                <p className="text-sm text-muted-foreground">{rd.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

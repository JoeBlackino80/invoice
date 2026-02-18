"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface ApiKey {
  id: string
  name: string
  key: string
  permissions: string[]
  created_at: string
  last_used_at: string | null
}

const availablePermissions = [
  { value: "invoices:read", label: "Faktury - citanie" },
  { value: "invoices:write", label: "Faktury - zapis" },
  { value: "contacts:read", label: "Kontakty - citanie" },
  { value: "contacts:write", label: "Kontakty - zapis" },
  { value: "products:read", label: "Produkty - citanie" },
  { value: "products:write", label: "Produkty - zapis" },
  { value: "reports:read", label: "Reporty - citanie" },
  { value: "warehouse:read", label: "Sklad - citanie" },
  { value: "warehouse:write", label: "Sklad - zapis" },
]

export default function ApiKeysPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const [newKeyResult, setNewKeyResult] = useState<string | null>(null)
  const [newKeyForm, setNewKeyForm] = useState({ name: "", permissions: [] as string[] })

  const fetchKeys = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/settings/api-keys?company_id=${activeCompanyId}`)
      if (res.ok) {
        const data = await res.json()
        setKeys(data)
      }
    } catch {
      toast({ title: "Chyba pri nacitani API klucov", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const handleCreate = async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          name: newKeyForm.name,
          permissions: newKeyForm.permissions,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setNewKeyResult(data.key)
        setNewKeyForm({ name: "", permissions: [] })
        fetchKeys()
      } else {
        const err = await res.json()
        toast({ title: "Chyba", description: err.error?.toString(), variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri vytvarani API kluca", variant: "destructive" })
    }
  }

  const handleRevoke = async (id: string) => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(
        `/api/settings/api-keys?id=${id}&company_id=${activeCompanyId}`,
        { method: "DELETE" }
      )
      if (res.ok) {
        toast({ title: "API kluc bol zruseny" })
        setConfirmRevoke(null)
        fetchKeys()
      } else {
        const err = await res.json()
        toast({ title: "Chyba", description: err.error?.toString(), variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri ruseni API kluca", variant: "destructive" })
    }
  }

  const togglePermission = (perm: string) => {
    setNewKeyForm((prev) => {
      const exists = prev.permissions.includes(perm)
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((p) => p !== perm)
          : [...prev.permissions, perm],
      }
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Skopovane do schranky" })
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
          <h1 className="text-3xl font-bold tracking-tight">API kluce</h1>
          <p className="text-muted-foreground">
            Spravujte API kluce pre externu integraciu
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) {
              setNewKeyResult(null)
              setNewKeyForm({ name: "", permissions: [] })
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>Novy API kluc</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {newKeyResult ? "API kluc bol vytvoreny" : "Novy API kluc"}
              </DialogTitle>
              <DialogDescription>
                {newKeyResult
                  ? "Skopirujte si kluc. Po zatvoreni dialogu uz nebude zobrazeny."
                  : "Zadajte nazov a vyberte opravnenia pre novy API kluc"}
              </DialogDescription>
            </DialogHeader>

            {newKeyResult ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted p-4">
                  <p className="mb-2 text-sm font-medium">Vas API kluc:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-background p-2 text-sm">
                      {newKeyResult}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(newKeyResult)}
                    >
                      Kopirovat
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <p className="text-sm text-yellow-800">
                    Upozornenie: Tento kluc sa zobrazi len raz. Ulozte si ho na bezpecne miesto.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Nazov</Label>
                  <Input
                    id="key-name"
                    value={newKeyForm.name}
                    onChange={(e) =>
                      setNewKeyForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Nazov API kluca"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Opravnenia</Label>
                  <div className="space-y-2">
                    {availablePermissions.map((perm) => (
                      <div key={perm.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`perm-${perm.value}`}
                          checked={newKeyForm.permissions.includes(perm.value)}
                          onCheckedChange={() => togglePermission(perm.value)}
                        />
                        <Label htmlFor={`perm-${perm.value}`} className="text-sm">
                          {perm.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              {newKeyResult ? (
                <Button onClick={() => setDialogOpen(false)}>Zavriet</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Zrusit
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!newKeyForm.name || newKeyForm.permissions.length === 0}
                  >
                    Vytvorit
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktivne API kluce</CardTitle>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Ziadne API kluce. Vytvorte prvy kluc pre externu integraciu.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazov</TableHead>
                  <TableHead>Kluc</TableHead>
                  <TableHead>Vytvoreny</TableHead>
                  <TableHead>Posledne pouzitie</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 text-sm">
                        {k.key}
                      </code>
                    </TableCell>
                    <TableCell>
                      {k.created_at
                        ? new Date(k.created_at).toLocaleDateString("sk-SK")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {k.last_used_at
                        ? new Date(k.last_used_at).toLocaleDateString("sk-SK")
                        : "Nikdy"}
                    </TableCell>
                    <TableCell className="text-right">
                      {confirmRevoke === k.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm text-muted-foreground">
                            Naozaj zrusit?
                          </span>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRevoke(k.id)}
                          >
                            Potvrdit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmRevoke(null)}
                          >
                            Zrusit
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setConfirmRevoke(k.id)}
                        >
                          Zrusit kluc
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* API usage info */}
      <Card>
        <CardHeader>
          <CardTitle>Pouzitie API</CardTitle>
          <CardDescription>
            Informacie o pouzivani API klucov
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              API kluce umoznuju pristup k vasim datam cez REST API.
              Pouzivajte ich pre integraciu s externymi systemami.
            </p>
            <p>
              Posielate kluc v hlavicke <code className="rounded bg-muted px-1">Authorization: Bearer sk_live_...</code>
            </p>
            <p>
              API dokumentacia je dostupna na <code className="rounded bg-muted px-1">/api/docs</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

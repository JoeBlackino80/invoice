"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface FiscalYear {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
  created_at: string
}

export default function FiscalYearsPage() {
  const { activeCompanyId, isAdmin } = useCompany()
  const { toast } = useToast()
  const [years, setYears] = useState<FiscalYear[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string } | null>(null)
  const [newYear, setNewYear] = useState({
    name: new Date().getFullYear().toString(),
    start_date: `${new Date().getFullYear()}-01-01`,
    end_date: `${new Date().getFullYear()}-12-31`,
  })

  const fetchYears = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/settings/fiscal-years?company_id=${activeCompanyId}`)
      if (res.ok) {
        const data = await res.json()
        setYears(data)
      }
    } catch {
      toast({ title: "Chyba pri nacitani fiskalnych rokov", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchYears()
  }, [fetchYears])

  const handleCreate = async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch("/api/settings/fiscal-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          ...newYear,
        }),
      })
      if (res.ok) {
        toast({ title: "Fiskalny rok bol vytvoreny" })
        setDialogOpen(false)
        fetchYears()
      } else {
        const err = await res.json()
        toast({ title: "Chyba", description: err.error?.toString(), variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri vytvarani", variant: "destructive" })
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!activeCompanyId) return
    try {
      const res = await fetch("/api/settings/fiscal-years", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          company_id: activeCompanyId,
          status: newStatus,
        }),
      })
      if (res.ok) {
        toast({
          title: newStatus === "closed" ? "Fiskalny rok bol uzavrety" : "Fiskalny rok bol znovuotvoreny",
        })
        setConfirmAction(null)
        fetchYears()
      } else {
        const err = await res.json()
        toast({ title: "Chyba", description: err.error?.toString(), variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri zmene stavu", variant: "destructive" })
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
          <h1 className="text-3xl font-bold tracking-tight">Fiskalne roky</h1>
          <p className="text-muted-foreground">
            Sprava fiskalnych rokov a uctovnych obdobi
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Novy fiskalny rok</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novy fiskalny rok</DialogTitle>
              <DialogDescription>
                Vytvorte novy fiskalny rok pre uctovne obdobie
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fy-name">Nazov</Label>
                <Input
                  id="fy-name"
                  value={newYear.name}
                  onChange={(e) =>
                    setNewYear((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="2026"
                />
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fy-start">Zaciatok</Label>
                  <Input
                    id="fy-start"
                    type="date"
                    value={newYear.start_date}
                    onChange={(e) =>
                      setNewYear((prev) => ({
                        ...prev,
                        start_date: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fy-end">Koniec</Label>
                  <Input
                    id="fy-end"
                    type="date"
                    value={newYear.end_date}
                    onChange={(e) =>
                      setNewYear((prev) => ({
                        ...prev,
                        end_date: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Zrusit
              </Button>
              <Button onClick={handleCreate}>Vytvorit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prehled fiskalnych rokov</CardTitle>
        </CardHeader>
        <CardContent>
          {years.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Ziadne fiskalne roky. Vytvorte prvy fiskalny rok.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazov</TableHead>
                  <TableHead>Zaciatok</TableHead>
                  <TableHead>Koniec</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {years.map((year) => (
                  <TableRow key={year.id}>
                    <TableCell className="font-medium">{year.name}</TableCell>
                    <TableCell>{year.start_date}</TableCell>
                    <TableCell>{year.end_date}</TableCell>
                    <TableCell>
                      <Badge
                        variant={year.status === "active" ? "default" : "secondary"}
                        className={
                          year.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {year.status === "active" ? "Aktivny" : "Uzavrety"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {confirmAction?.id === year.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm text-muted-foreground">
                            {confirmAction.action === "close"
                              ? "Naozaj uzavriet?"
                              : "Naozaj znovuotvorit? Toto moze ovplyvnit uzavrete uctovnictvo."}
                          </span>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              handleStatusChange(
                                year.id,
                                confirmAction.action === "close" ? "closed" : "active"
                              )
                            }
                          >
                            Potvrdit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmAction(null)}
                          >
                            Zrusit
                          </Button>
                        </div>
                      ) : (
                        <>
                          {year.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setConfirmAction({ id: year.id, action: "close" })
                              }
                            >
                              Uzavriet
                            </Button>
                          ) : (
                            isAdmin() && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setConfirmAction({ id: year.id, action: "reopen" })
                                }
                              >
                                Znovuotvorit
                              </Button>
                            )
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
    </div>
  )
}

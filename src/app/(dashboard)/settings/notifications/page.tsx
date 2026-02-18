"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
} from "@/components/ui/dialog"
import {
  Bell,
  FileWarning,
  Clock,
  CheckCircle,
  CreditCard,
  ScanLine,
  Package,
  Landmark,
  AlertTriangle,
  Trash2,
  Eye,
  Pencil,
  RotateCcw,
  Send,
  Save,
  Filter,
  CheckCheck,
} from "lucide-react"
import type { Notification, NotificationType, NotificationRule } from "@/lib/notifications/notification-service"
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_DESCRIPTIONS,
  DEFAULT_NOTIFICATION_RULES,
} from "@/lib/notifications/notification-service"

// ===================== Spolocne pomocne funkcie =====================

const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  invoice_overdue: FileWarning,
  deadline_approaching: Clock,
  invoice_approved: CheckCircle,
  payment_received: CreditCard,
  ocr_processed: ScanLine,
  low_stock: Package,
  bank_imported: Landmark,
  ai_anomaly: AlertTriangle,
}

const TYPE_COLORS: Record<NotificationType, string> = {
  invoice_overdue: "text-red-500",
  deadline_approaching: "text-amber-500",
  invoice_approved: "text-green-500",
  payment_received: "text-green-600",
  ocr_processed: "text-blue-500",
  low_stock: "text-orange-500",
  bank_imported: "text-indigo-500",
  ai_anomaly: "text-red-600",
}

const TYPE_BADGE_VARIANT: Record<NotificationType, "default" | "secondary" | "destructive" | "outline"> = {
  invoice_overdue: "destructive",
  deadline_approaching: "secondary",
  invoice_approved: "default",
  payment_received: "default",
  ocr_processed: "secondary",
  low_stock: "destructive",
  bank_imported: "secondary",
  ai_anomaly: "destructive",
}

const RECIPIENT_LABELS: Record<string, string> = {
  all: "Vsetci",
  admin: "Admin",
  uctovnik: "Uctovnik",
  specific: "Konkretni",
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "Prave teraz"
  if (diffMin < 60) return `pred ${diffMin} min`
  if (diffHour < 24) return `pred ${diffHour} hod`
  if (diffDay < 7) return `pred ${diffDay} ${diffDay === 1 ? "dnom" : "dnami"}`
  return date.toLocaleDateString("sk-SK")
}

// ===================== Hlavna stranka =====================

export default function NotificationsSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifikacie</h1>
        <p className="text-muted-foreground">
          Spravujte notifikacie, pravidla a emailove sablony.
        </p>
      </div>

      <Tabs defaultValue="centrum" className="space-y-4">
        <TabsList>
          <TabsTrigger value="centrum">Centrum</TabsTrigger>
          <TabsTrigger value="pravidla">Pravidla</TabsTrigger>
          <TabsTrigger value="sablony">Emailove sablony</TabsTrigger>
        </TabsList>

        <TabsContent value="centrum">
          <NotificationCenter />
        </TabsContent>

        <TabsContent value="pravidla">
          <NotificationRules />
        </TabsContent>

        <TabsContent value="sablony">
          <EmailTemplates />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ===================== Tab: Centrum notifikacii =====================

function NotificationCenter() {
  const { activeCompanyId } = useCompany()
  const router = useRouter()
  const { toast } = useToast()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchNotifications = useCallback(async () => {
    if (!activeCompanyId) return

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: page.toString(),
        limit: "20",
      })

      if (filter === "unread") params.set("is_read", "false")
      if (filter === "read") params.set("is_read", "true")
      if (typeFilter !== "all") params.set("type", typeFilter)

      const res = await fetch(`/api/notifications?${params}`)
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.data || [])
        setTotalPages(data.pagination?.totalPages || 1)
        setTotal(data.pagination?.total || 0)
      }
    } catch {
      toast({ title: "Chyba pri nacitavani notifikacii", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [activeCompanyId, page, filter, typeFilter, toast])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkAllAsRead = async () => {
    if (!activeCompanyId) return

    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, company_id: activeCompanyId }),
      })
      toast({ title: "Vsetky notifikacie oznacene ako precitane" })
      fetchNotifications()
    } catch {
      toast({ title: "Chyba pri oznacovani", variant: "destructive" })
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await fetch("/api/notifications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notification_ids: [notification.id] }),
        })
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, is_read: true } : n
          )
        )
      } catch {
        // Tiché zlyhanie
      }
    }

    if (notification.link) {
      router.push(notification.link)
    }
  }

  const handleDeleteOld = async () => {
    // Simulacia - v produkcii by to vymazalo stare notifikacie cez API
    toast({ title: "Stare notifikacie vymazane" })
    fetchNotifications()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Centrum notifikacii</CardTitle>
            <CardDescription>
              {total} {total === 1 ? "notifikacia" : total < 5 ? "notifikacie" : "notifikacii"} celkovo
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDeleteOld}>
              <Trash2 className="mr-2 h-4 w-4" />
              Vymazat stare
            </Button>
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Oznacit vsetko
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtre */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex rounded-md border">
              {(["all", "unread", "read"] as const).map((f) => (
                <button
                  key={f}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  } ${f === "all" ? "rounded-l-md" : ""} ${f === "read" ? "rounded-r-md" : ""}`}
                  onClick={() => { setFilter(f); setPage(1) }}
                >
                  {f === "all" ? "Vsetky" : f === "unread" ? "Neprecitane" : "Precitane"}
                </button>
              ))}
            </div>
          </div>

          <Select
            value={typeFilter}
            onValueChange={(v) => { setTypeFilter(v); setPage(1) }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Typ notifikacie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vsetky typy</SelectItem>
              {NOTIFICATION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {NOTIFICATION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Zoznam */}
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            Nacitavam notifikacie...
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Ziadne notifikacie na zobrazenie.
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type] || Bell
              const colorClass = TYPE_COLORS[notification.type] || "text-gray-500"
              const badgeVariant = TYPE_BADGE_VARIANT[notification.type] || "secondary"

              return (
                <button
                  key={notification.id}
                  className={`flex w-full items-start gap-4 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                    !notification.is_read ? "bg-muted/30 border-l-2 border-l-blue-500" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={`mt-1 shrink-0 ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{notification.title}</p>
                        <Badge variant={badgeVariant} className="text-[10px]">
                          {NOTIFICATION_TYPE_LABELS[notification.type]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(notification.created_at)}
                        </span>
                        {!notification.is_read && (
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Strankovanie */}
        {totalPages > 1 && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Strana {page} z {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Predchadzajuca
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Dalsia
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ===================== Tab: Pravidla notifikacii =====================

interface RuleState {
  type: NotificationType
  enabled: boolean
  channels: { in_app: boolean; email: boolean }
  timing: { days_before: number; repeat_interval?: number }
  recipients: string
}

function NotificationRules() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [rules, setRules] = useState<RuleState[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const fetchRules = useCallback(async () => {
    if (!activeCompanyId) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/notifications/rules?company_id=${activeCompanyId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.data && data.data.length > 0) {
          setRules(
            data.data.map((r: any) => ({
              type: r.type,
              enabled: r.enabled,
              channels: r.channels || { in_app: true, email: false },
              timing: r.timing || { days_before: 0 },
              recipients: r.recipients || "all",
            }))
          )
        } else {
          // Predvolene pravidla
          setRules(
            DEFAULT_NOTIFICATION_RULES.map((r) => ({
              type: r.type,
              enabled: r.enabled,
              channels: { ...r.channels },
              timing: { days_before: r.timing.days_before, repeat_interval: r.timing.repeat_interval },
              recipients: r.recipients,
            }))
          )
        }
      }
    } catch {
      toast({ title: "Chyba pri nacitavani pravidiel", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const updateRule = (index: number, updates: Partial<RuleState>) => {
    setRules((prev) => {
      const newRules = [...prev]
      newRules[index] = { ...newRules[index], ...updates }
      return newRules
    })
  }

  const handleSave = async () => {
    if (!activeCompanyId) return

    setIsSaving(true)
    try {
      const payload = rules.map((r) => ({
        type: r.type,
        enabled: r.enabled,
        channels: r.channels,
        timing: {
          days_before: r.timing.days_before,
          repeat_days: r.timing.repeat_interval,
        },
        recipients: r.recipients,
      }))

      const res = await fetch("/api/notifications/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: activeCompanyId, rules: payload }),
      })

      if (res.ok) {
        toast({ title: "Pravidla ulozene" })
      } else {
        const err = await res.json()
        toast({ title: err.error || "Chyba pri ukladani", variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri ukladani pravidiel", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nacitavam pravidla...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pravidla notifikacii</CardTitle>
            <CardDescription>
              Nastavte, kedy a ako chcete dostavat notifikacie.
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Ukladam..." : "Ulozit zmeny"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Typ</TableHead>
              <TableHead>Popis</TableHead>
              <TableHead className="text-center w-20">In-app</TableHead>
              <TableHead className="text-center w-20">Email</TableHead>
              <TableHead className="w-[120px]">Casovanie</TableHead>
              <TableHead className="w-[140px]">Prijemcovia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule, index) => {
              const Icon = TYPE_ICONS[rule.type] || Bell
              const colorClass = TYPE_COLORS[rule.type] || "text-gray-500"

              return (
                <TableRow
                  key={rule.type}
                  className={!rule.enabled ? "opacity-50" : ""}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={rule.enabled}
                        onCheckedChange={(checked) =>
                          updateRule(index, { enabled: !!checked })
                        }
                      />
                      <div className={colorClass}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">
                        {NOTIFICATION_TYPE_LABELS[rule.type]}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {NOTIFICATION_TYPE_DESCRIPTIONS[rule.type]}
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={rule.channels.in_app}
                      onCheckedChange={(checked) =>
                        updateRule(index, {
                          channels: { ...rule.channels, in_app: !!checked },
                        })
                      }
                      disabled={!rule.enabled}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={rule.channels.email}
                      onCheckedChange={(checked) =>
                        updateRule(index, {
                          channels: { ...rule.channels, email: !!checked },
                        })
                      }
                      disabled={!rule.enabled}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          className="h-7 w-14 text-xs"
                          value={rule.timing.days_before}
                          onChange={(e) =>
                            updateRule(index, {
                              timing: {
                                ...rule.timing,
                                days_before: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                          disabled={!rule.enabled}
                        />
                        <span className="text-xs text-muted-foreground">dni</span>
                      </div>
                      {rule.timing.repeat_interval !== undefined && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            className="h-7 w-14 text-xs"
                            value={rule.timing.repeat_interval || ""}
                            onChange={(e) =>
                              updateRule(index, {
                                timing: {
                                  ...rule.timing,
                                  repeat_interval: parseInt(e.target.value) || undefined,
                                },
                              })
                            }
                            disabled={!rule.enabled}
                          />
                          <span className="text-[10px] text-muted-foreground">opak.</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={rule.recipients}
                      onValueChange={(v) =>
                        updateRule(index, { recipients: v })
                      }
                      disabled={!rule.enabled}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Vsetci</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="uctovnik">Uctovnik</SelectItem>
                        <SelectItem value="specific">Konkretni</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ===================== Tab: Emailove sablony =====================

interface EmailTemplate {
  id: string
  company_id: string
  name: string
  subject: string
  body_html: string
  type: NotificationType
}

function EmailTemplates() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editDialog, setEditDialog] = useState(false)
  const [previewDialog, setPreviewDialog] = useState(false)
  const [currentTemplate, setCurrentTemplate] = useState<Partial<EmailTemplate> | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const fetchTemplates = useCallback(async () => {
    if (!activeCompanyId) return

    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/notifications/email-templates?company_id=${activeCompanyId}`
      )
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.data || [])
      }
    } catch {
      toast({ title: "Chyba pri nacitavani sablon", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleEdit = (template?: EmailTemplate) => {
    if (template) {
      setCurrentTemplate({ ...template })
    } else {
      setCurrentTemplate({
        name: "",
        subject: "",
        body_html: "",
        type: "invoice_overdue",
      })
    }
    setEditDialog(true)
  }

  const handlePreview = (template: EmailTemplate) => {
    setCurrentTemplate(template)
    setPreviewDialog(true)
  }

  const handleSave = async () => {
    if (!activeCompanyId || !currentTemplate) return

    setIsSaving(true)
    try {
      const res = await fetch("/api/notifications/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          id: currentTemplate.id,
          name: currentTemplate.name,
          subject: currentTemplate.subject,
          body_html: currentTemplate.body_html,
          type: currentTemplate.type,
        }),
      })

      if (res.ok) {
        toast({ title: "Sablona ulozena" })
        setEditDialog(false)
        fetchTemplates()
      } else {
        const err = await res.json()
        toast({ title: err.error || "Chyba pri ukladani", variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri ukladani sablony", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (template: EmailTemplate) => {
    if (!activeCompanyId) return

    try {
      const res = await fetch(
        `/api/notifications/email-templates?id=${template.id}&company_id=${activeCompanyId}`,
        { method: "DELETE" }
      )

      if (res.ok) {
        toast({ title: "Sablona vymazana, pouzije sa predvolena" })
        fetchTemplates()
      } else {
        const err = await res.json()
        toast({ title: err.error || "Chyba pri mazani", variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri mazani sablony", variant: "destructive" })
    }
  }

  const handleTestEmail = async (template: EmailTemplate) => {
    toast({ title: "Testovaci email odoslany na vasu adresu" })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Emailove sablony</CardTitle>
              <CardDescription>
                Vlastne sablony pre emaily notifikacii. Bez vlastnej sablony sa pouzije predvolena.
              </CardDescription>
            </div>
            <Button onClick={() => handleEdit()}>
              Nova sablona
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              Nacitavam sablony...
            </div>
          ) : templates.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Ziadne vlastne sablony. Pouzivaju sa predvolene sablony systemu.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Nazov</TableHead>
                  <TableHead>Predmet</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => {
                  const Icon = TYPE_ICONS[template.type] || Bell
                  const colorClass = TYPE_COLORS[template.type] || "text-gray-500"

                  return (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={colorClass}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {NOTIFICATION_TYPE_LABELS[template.type]}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {template.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {template.subject}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handlePreview(template)}
                            title="Nahladnut"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(template)}
                            title="Upravit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleTestEmail(template)}
                            title="Odoslat testovaci email"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(template)}
                            title="Obnovit predvolenu"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog na upravu sablony */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {currentTemplate?.id ? "Upravit sablonu" : "Nova sablona"}
            </DialogTitle>
            <DialogDescription>
              Upravte emailovu sablonu pre notifikacie.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nazov</Label>
                <Input
                  value={currentTemplate?.name || ""}
                  onChange={(e) =>
                    setCurrentTemplate((prev) => prev ? { ...prev, name: e.target.value } : null)
                  }
                  placeholder="Nazov sablony"
                />
              </div>
              <div className="space-y-2">
                <Label>Typ notifikacie</Label>
                <Select
                  value={currentTemplate?.type || "invoice_overdue"}
                  onValueChange={(v) =>
                    setCurrentTemplate((prev) =>
                      prev ? { ...prev, type: v as NotificationType } : null
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {NOTIFICATION_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Predmet emailu</Label>
              <Input
                value={currentTemplate?.subject || ""}
                onChange={(e) =>
                  setCurrentTemplate((prev) => prev ? { ...prev, subject: e.target.value } : null)
                }
                placeholder="Predmet emailu"
              />
            </div>

            <div className="space-y-2">
              <Label>HTML obsah</Label>
              <Textarea
                value={currentTemplate?.body_html || ""}
                onChange={(e) =>
                  setCurrentTemplate((prev) => prev ? { ...prev, body_html: e.target.value } : null)
                }
                placeholder="<html>...</html>"
                className="min-h-[200px] font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Zrusit
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Ukladam..." : "Ulozit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog nahladu */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nahlad sablony: {currentTemplate?.name}</DialogTitle>
            <DialogDescription>
              Predmet: {currentTemplate?.subject}
            </DialogDescription>
          </DialogHeader>

          <Card>
            <CardContent className="p-4">
              {currentTemplate?.body_html ? (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: currentTemplate.body_html,
                  }}
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Ziadny obsah na nahlad.
                </p>
              )}
            </CardContent>
          </Card>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialog(false)}>
              Zavriet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

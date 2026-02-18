"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useCompany } from "@/hooks/use-company"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
  CheckCheck,
} from "lucide-react"
import type { Notification, NotificationType } from "@/lib/notifications/notification-service"

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

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "Práve teraz"
  if (diffMin < 60) return `pred ${diffMin} min`
  if (diffHour < 24) return `pred ${diffHour} hod`
  if (diffDay < 7) return `pred ${diffDay} ${diffDay === 1 ? "dňom" : diffDay < 5 ? "dňami" : "dňami"}`
  return date.toLocaleDateString("sk-SK")
}

export function NotificationBell() {
  const { user } = useAuth()
  const { activeCompanyId } = useCompany()
  const router = useRouter()
  const supabase = createClient()

  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchUnreadCount = useCallback(async () => {
    if (!user || !activeCompanyId) return

    try {
      const res = await fetch(
        `/api/notifications/unread-count?company_id=${activeCompanyId}`
      )
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count || 0)
      }
    } catch {
      // Tiché zlyhanie pri pollingu
    }
  }, [user, activeCompanyId])

  const fetchLatestNotifications = useCallback(async () => {
    if (!user || !activeCompanyId) return

    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/notifications?company_id=${activeCompanyId}&limit=5&page=1`
      )
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.data || [])
      }
    } catch {
      // Tiché zlyhanie
    } finally {
      setIsLoading(false)
    }
  }, [user, activeCompanyId])

  // Polling neprečítaných každých 30 sekúnd
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Načítať notifikácie pri otvorení
  useEffect(() => {
    if (isOpen) {
      fetchLatestNotifications()
    }
  }, [isOpen, fetchLatestNotifications])

  // Zavrieť dropdown pri kliknutí mimo
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const handleMarkAllAsRead = async () => {
    if (!activeCompanyId) return

    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, company_id: activeCompanyId }),
      })
      setUnreadCount(0)
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      )
    } catch {
      // Tiché zlyhanie
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    // Označiť ako prečítané
    if (!notification.is_read) {
      try {
        await fetch("/api/notifications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notification_ids: [notification.id] }),
        })
        setUnreadCount((prev) => Math.max(0, prev - 1))
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, is_read: true } : n
          )
        )
      } catch {
        // Tiché zlyhanie
      }
    }

    setIsOpen(false)

    // Navigovať na odkaz
    if (notification.link) {
      router.push(notification.link)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifikácie"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-lg border bg-card shadow-lg">
          {/* Hlavička */}
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-sm font-semibold">Notifikácie</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
                onClick={handleMarkAllAsRead}
              >
                <CheckCheck className="mr-1 h-3 w-3" />
                Oznacit vsetko ako precitane
              </Button>
            )}
          </div>

          <Separator />

          {/* Zoznam notifikácií */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nacitavam...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Ziadne notifikacie
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = TYPE_ICONS[notification.type] || Bell
                const colorClass = TYPE_COLORS[notification.type] || "text-gray-500"

                return (
                  <button
                    key={notification.id}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                      !notification.is_read ? "bg-muted/30" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={`mt-0.5 shrink-0 ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight truncate">
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <Separator />

          {/* Päta */}
          <div className="px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setIsOpen(false)
                router.push("/settings/notifications")
              }}
            >
              Zobrazit vsetky notifikacie
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

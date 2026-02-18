"use client"

import { useState, useEffect, useCallback } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCompany } from "@/hooks/use-company"
import { formatRelativeTime } from "@/lib/format"

export function NotificationsPanel() {
  const { activeCompanyId } = useCompany()
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/notifications?company_id=${activeCompanyId}&is_read=false&limit=10`)
      const data = await res.json()
      setNotifications(data.data || [])
      setUnreadCount((data.data || []).length)
    } catch {}
  }, [activeCompanyId])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const markAllRead = async () => {
    try {
      await fetch(`/api/notifications/mark-read`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ company_id: activeCompanyId }) })
      setNotifications([])
      setUnreadCount(0)
    } catch {}
  }

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen(!open)}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-background border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="font-medium text-sm">Notifikácie</span>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={markAllRead}>
                Označiť všetky
              </Button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Žiadne nové notifikácie</div>
          ) : (
            notifications.map((n: any) => (
              <a key={n.id} href={n.link || "#"} className="block p-3 border-b hover:bg-muted/50 transition-colors" onClick={() => setOpen(false)}>
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                <div className="text-xs text-muted-foreground mt-1">{formatRelativeTime(n.created_at)}</div>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  )
}

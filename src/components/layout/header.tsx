"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { CompanySwitcher } from "@/components/layout/company-switcher"
import { CommandMenu } from "@/components/layout/command-menu"
import { NotificationBell } from "@/components/layout/notification-bell"
import {
  Bell,
  LogOut,
  Search,
  User,
} from "lucide-react"

export function Header() {
  const { user } = useAuth()
  const { activeCompany } = useCompany()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  const userName = user?.user_metadata?.full_name || user?.email || ""

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <CompanySwitcher />
        <CommandMenu />
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />

        <ThemeToggle />

        <div className="flex items-center gap-2 pl-2 border-l">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium leading-none">{userName}</p>
            <p className="text-xs text-muted-foreground">{activeCompany?.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Odhlásiť sa">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  Landmark,
  Wallet,
  Package,
  Users,
  Car,
  Calculator,
  ClipboardList,
  BarChart3,
  Contact,
  Building,
  Settings,
  Bot,
  ChevronLeft,
  ChevronRight,
  Repeat,
  FileCheck,
  ShoppingCart,
  ScanLine,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Fakturácia", href: "/invoices", icon: FileText },
  { name: "Ponuky", href: "/quotes", icon: FileCheck },
  { name: "Objednávky", href: "/orders", icon: ShoppingCart },
  { name: "Opakované", href: "/recurring", icon: Repeat },
  { name: "Dokumenty", href: "/documents", icon: ScanLine },
  { name: "Účtovníctvo", href: "/accounting", icon: BookOpen },
  { name: "Banka", href: "/bank", icon: Landmark },
  { name: "Pokladňa", href: "/cash-register", icon: Wallet },
  { name: "Sklad", href: "/warehouse", icon: Package },
  { name: "Mzdy", href: "/payroll", icon: Users },
  { name: "Cestovné príkazy", href: "/travel", icon: Car },
  { name: "Dane", href: "/taxes", icon: Calculator },
  { name: "Závierka", href: "/closing", icon: ClipboardList },
  { name: "Reporty", href: "/reports", icon: BarChart3 },
  { name: "Kontakty", href: "/contacts", icon: Contact },
  { name: "Majetok", href: "/assets", icon: Building },
  { name: "Nastavenia", href: "/settings", icon: Settings },
  { name: "AI Asistent", href: "/ai-assistant", icon: Bot },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen flex-col border-r bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">Účtovníctvo</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Command } from "cmdk"
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
  Search,
  Plus,
  Loader2,
} from "lucide-react"

const pages = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Faktúry – odoslané", href: "/invoices?type=vydana", icon: FileText },
  { name: "Faktúry – prijaté", href: "/invoices?type=prijata", icon: FileText },
  { name: "Nová faktúra", href: "/invoices/new", icon: Plus },
  { name: "Účtovníctvo", href: "/accounting", icon: BookOpen },
  { name: "Účtovný denník", href: "/accounting/journal", icon: BookOpen },
  { name: "Hlavná kniha", href: "/accounting/ledger", icon: BookOpen },
  { name: "Banka", href: "/bank", icon: Landmark },
  { name: "Pokladňa", href: "/cash-register", icon: Wallet },
  { name: "Sklad", href: "/warehouse", icon: Package },
  { name: "Mzdy", href: "/payroll", icon: Users },
  { name: "Cestovné príkazy", href: "/travel", icon: Car },
  { name: "DPH", href: "/taxes/vat", icon: Calculator },
  { name: "Kontrolný výkaz", href: "/taxes/control-statement", icon: Calculator },
  { name: "Daň z príjmov", href: "/taxes/income-tax", icon: Calculator },
  { name: "Závierka", href: "/closing", icon: ClipboardList },
  { name: "Reporty", href: "/reports", icon: BarChart3 },
  { name: "Kontakty", href: "/contacts", icon: Contact },
  { name: "Nový kontakt", href: "/contacts/new", icon: Plus },
  { name: "Majetok", href: "/assets", icon: Building },
  { name: "Nastavenia", href: "/settings", icon: Settings },
  { name: "AI Asistent", href: "/ai-assistant", icon: Bot },
]

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [searchResults, setSearchResults] = useState<{ invoices: any[]; contacts: any[]; transactions: any[] }>({ invoices: [], contacts: [], transactions: [] })
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const router = useRouter()
  const { activeCompanyId } = useCompany()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const handleSearch = (value: string) => {
    setSearchValue(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (value.length >= 3 && activeCompanyId) {
      searchTimeoutRef.current = setTimeout(async () => {
        setSearching(true)
        try {
          const [invRes, contRes] = await Promise.all([
            fetch(`/api/invoices?search=${encodeURIComponent(value)}&limit=5&company_id=${activeCompanyId}`),
            fetch(`/api/contacts?search=${encodeURIComponent(value)}&limit=5&company_id=${activeCompanyId}`),
          ])
          const [invData, contData] = await Promise.all([invRes.json(), contRes.json()])
          setSearchResults({
            invoices: invData.data || [],
            contacts: contData.data || [],
            transactions: [],
          })
        } catch {}
        setSearching(false)
      }, 300)
    } else {
      setSearchResults({ invoices: [], contacts: [], transactions: [] })
    }
  }

  const runCommand = (command: () => void) => {
    setOpen(false)
    setSearchValue("")
    setSearchResults({ invoices: [], contacts: [], transactions: [] })
    command()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Hľadať...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 md:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)} />
          <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2">
            <Command className="rounded-lg border bg-popover shadow-lg">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Command.Input
                  placeholder="Hľadať stránku, faktúru, kontakt..."
                  className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                  value={searchValue}
                  onValueChange={handleSearch}
                />
              </div>
              <Command.List className="max-h-[300px] overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  Žiadne výsledky.
                </Command.Empty>
                <Command.Group heading="Navigácia" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                  {pages.map((page) => (
                    <Command.Item
                      key={page.href}
                      value={page.name}
                      onSelect={() => runCommand(() => router.push(page.href))}
                      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent aria-selected:bg-accent"
                    >
                      <page.icon className="h-4 w-4" />
                      {page.name}
                    </Command.Item>
                  ))}
                </Command.Group>
                {searching && (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Hľadám...
                  </div>
                )}
                {searchResults.invoices.length > 0 && (
                  <Command.Group heading="Faktúry" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                    {searchResults.invoices.map((inv: any) => (
                      <Command.Item
                        key={inv.id}
                        value={`invoice-${inv.number}-${inv.customer_name || inv.supplier_name}`}
                        onSelect={() => runCommand(() => router.push(`/invoices/${inv.id}/edit`))}
                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent aria-selected:bg-accent"
                      >
                        <FileText className="h-4 w-4" />
                        <span>{inv.number} - {inv.customer_name || inv.supplier_name} ({inv.total} €)</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {searchResults.contacts.length > 0 && (
                  <Command.Group heading="Kontakty" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                    {searchResults.contacts.map((c: any) => (
                      <Command.Item
                        key={c.id}
                        value={`contact-${c.name}-${c.ico || ""}`}
                        onSelect={() => runCommand(() => router.push(`/contacts/${c.id}`))}
                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent aria-selected:bg-accent"
                      >
                        <Users className="h-4 w-4" />
                        <span>{c.name} {c.ico ? `(IČO: ${c.ico})` : ""}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </div>
        </>
      )}
    </>
  )
}

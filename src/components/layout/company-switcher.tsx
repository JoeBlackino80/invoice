"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Building2, ChevronsUpDown, Check, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export function CompanySwitcher() {
  const [open, setOpen] = useState(false)
  const { companies, activeCompany, setActiveCompany } = useCompany()
  const router = useRouter()

  if (!activeCompany) {
    return (
      <Button variant="outline" size="sm" onClick={() => router.push("/onboarding")}>
        <Plus className="mr-2 h-4 w-4" />
        Pridať firmu
      </Button>
    )
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="justify-between gap-2 min-w-[200px]"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{activeCompany.name}</span>
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-[280px] rounded-md border bg-popover p-1 shadow-md">
            {companies.map((ucr) => (
              <button
                key={ucr.company_id}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                  ucr.company_id === activeCompany.id && "bg-accent"
                )}
                onClick={() => {
                  setActiveCompany(ucr.company_id)
                  setOpen(false)
                  router.refresh()
                }}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <div className="flex-1 text-left">
                  <p className="font-medium">{ucr.company.name}</p>
                  <p className="text-xs text-muted-foreground">{ucr.role}</p>
                </div>
                {ucr.company_id === activeCompany.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
            <div className="border-t mt-1 pt-1">
              <button
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => {
                  setOpen(false)
                  router.push("/onboarding")
                }}
              >
                <Plus className="h-4 w-4" />
                Pridať firmu
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

"use client"

import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  BookOpen,
  FileSpreadsheet,
  BookMarked,
  BarChart3,
  Users,
  Wallet,
  Building2,
  FolderKanban,
} from "lucide-react"

const accountingModules = [
  {
    title: "Uctovy rozvrh",
    description: "Sprava syntetickych a analytickych uctov podla slovenskej uctovnej osnovy",
    href: "/accounting/chart-of-accounts",
    icon: BookOpen,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
  },
  {
    title: "Uctovny dennik",
    description: "Chronologicky zaznam vsetkych uctovnych zapisov",
    href: "/accounting/journal",
    icon: FileSpreadsheet,
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950",
  },
  {
    title: "Hlavna kniha",
    description: "Systematicky prehlad uctov s obratmi a zostatkami",
    href: "/accounting/ledger",
    icon: BookMarked,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950",
  },
  {
    title: "Obratova predvaha",
    description: "Kontrolny prehlad obratov a zostatkov vsetkych uctov",
    href: "/accounting/trial-balance",
    icon: BarChart3,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950",
  },
  {
    title: "Saldokonto",
    description: "Prehlad neuhadenych pohladavok a zavazkov",
    href: "/accounting/saldokonto",
    icon: Users,
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950",
  },
  {
    title: "Pokladna",
    description: "Pokladnicna kniha, prijmove a vydajove doklady",
    href: "/cash-register",
    icon: Wallet,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950",
  },
  {
    title: "Strediska",
    description: "Sprava nakladovych stredisk pre vnutropodnikove uctovnictvo",
    href: "/accounting/cost-centers",
    icon: Building2,
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-950",
  },
  {
    title: "Zakazky / Projekty",
    description: "Sledovanie nakladov a vynosov podla jednotlivych zakazok",
    href: "/accounting/projects",
    icon: FolderKanban,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950",
  },
]

export default function AccountingPage() {
  const { activeCompany } = useCompany()

  if (!activeCompany) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <p className="text-muted-foreground">Nacitavam...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Uctovnictvo</h1>
        <p className="text-muted-foreground">
          Podvojne uctovnictvo - {activeCompany.name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {accountingModules.map((module) => (
          <Link key={module.href} href={module.href}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50">
              <CardHeader className="pb-3">
                <div className={`w-10 h-10 rounded-lg ${module.bg} flex items-center justify-center mb-2`}>
                  <module.icon className={`h-5 w-5 ${module.color}`} />
                </div>
                <CardTitle className="text-base">{module.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

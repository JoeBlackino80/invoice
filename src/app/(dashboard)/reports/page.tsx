"use client"

import { useCompany } from "@/hooks/use-company"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  Clock,
  TrendingUp,
  BarChart3,
  ArrowLeftRight,
  Gauge,
  Target,
  Users,
  Truck,
  FileWarning,
  Package,
  Download,
  FileBarChart,
} from "lucide-react"
import Link from "next/link"

const reportCards = [
  {
    title: "Aging pohladavok",
    description: "Analyza starnuceho dlhu odberatelov podla doby po splatnosti",
    href: "/reports/aging-receivables",
    icon: Clock,
    color: "text-blue-500",
  },
  {
    title: "Aging zavazkov",
    description: "Analyza vasich nezaplatenych faktur podla doby po splatnosti",
    href: "/reports/aging-payables",
    icon: Clock,
    color: "text-orange-500",
  },
  {
    title: "Cash flow prognoza",
    description: "AI predikovany vyvoj prijmov a vydavkov na zaklade historickych dat",
    href: "/reports/cash-flow-forecast",
    icon: TrendingUp,
    color: "text-green-500",
  },
  {
    title: "Porovnanie obdobi",
    description: "Porovnanie financnych metrik medzi dvoma obdobiami",
    href: "/reports/period-comparison",
    icon: ArrowLeftRight,
    color: "text-purple-500",
  },
  {
    title: "Financne ukazovatele",
    description: "Likvidita, zadlzenost, rentabilita a doba obratu",
    href: "/reports/financial-indicators",
    icon: Gauge,
    color: "text-indigo-500",
  },
  {
    title: "Top odberatelia",
    description: "Najvyznamnejsi zakaznici podla obratu a platobnej morálky",
    href: "/reports/top-customers",
    icon: Users,
    color: "text-cyan-500",
  },
  {
    title: "Top dodavatelia",
    description: "Najvyznamnejsi dodavatelia podla objemu nakupov",
    href: "/reports/top-suppliers",
    icon: Truck,
    color: "text-teal-500",
  },
  {
    title: "Neuhradene faktury",
    description: "Zoznam vsetkych neuplne uhradenych faktur",
    href: "/reports/unpaid-invoices",
    icon: FileWarning,
    color: "text-red-500",
  },
  {
    title: "Break-even analyza",
    description: "Vypocet bodu zvratu - kedy sa naklady pokryju trzby",
    href: "/reports/break-even",
    icon: Target,
    color: "text-amber-500",
  },
  {
    title: "Marza na produkt",
    description: "Analyza marze a ziskovosti jednotlivych produktov a sluzieb",
    href: "/reports/product-margin",
    icon: Package,
    color: "text-pink-500",
  },
  {
    title: "Export dat",
    description: "CSV export, auditorsky balicek a dalsie exporty",
    href: "/reports/export",
    icon: Download,
    color: "text-gray-500",
  },
  {
    title: "Statisticke vykazy",
    description: "Stvrtrocne a rocne statisticke vykazy pre SU SR",
    href: "/reports/statistics",
    icon: FileBarChart,
    color: "text-violet-500",
  },
]

export default function ReportsPage() {
  const { activeCompany, hasCompanies, isLoading } = useCompany()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !hasCompanies) {
      router.push("/onboarding")
    }
  }, [isLoading, hasCompanies, router])

  if (isLoading || !activeCompany) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Nacitavam...</p>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Financne reporty</h1>
        <p className="text-muted-foreground">
          Prehlad financnych reportov a analyz pre {activeCompany.name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportCards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.href} href={card.href}>
              <Card className="h-full transition-colors hover:bg-muted/50 cursor-pointer">
                <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                  <div className={`mt-1 ${card.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{card.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {card.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

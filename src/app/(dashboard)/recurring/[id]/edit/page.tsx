"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { RecurringForm } from "@/components/recurring/recurring-form"
import { Loader2 } from "lucide-react"

export default function EditRecurringInvoicePage() {
  const params = useParams()
  const [recurring, setRecurring] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRecurring = async () => {
      try {
        const res = await fetch(`/api/recurring-invoices/${params.id}`)
        if (res.ok) {
          const data = await res.json()
          setRecurring(data)
        }
      } catch {
        // handled by UI
      } finally {
        setLoading(false)
      }
    }
    fetchRecurring()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!recurring) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Opakovaná faktúra nenájdená</p>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Upraviť opakovanú faktúru</h1>
        <p className="text-muted-foreground">
          {recurring.is_active ? "Aktívna" : "Neaktívna"} – {recurring.interval === "monthly" ? "mesačne" : recurring.interval === "quarterly" ? "štvrťročne" : "ročne"}
        </p>
      </div>
      <RecurringForm recurring={recurring} mode="edit" />
    </div>
  )
}

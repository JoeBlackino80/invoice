"use client"

import { Breadcrumb } from "@/components/layout/breadcrumb"
import { RecurringForm } from "@/components/recurring/recurring-form"

export default function NewRecurringInvoicePage() {
  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Nová opakovaná faktúra</h1>
        <p className="text-muted-foreground">Vytvorte šablónu pre automatické generovanie faktúr</p>
      </div>
      <RecurringForm mode="create" />
    </div>
  )
}

"use client"

import { Breadcrumb } from "@/components/layout/breadcrumb"
import { InvoiceForm } from "@/components/invoices/invoice-form"

export default function NewInvoicePage() {
  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Nová faktúra</h1>
        <p className="text-muted-foreground">Vytvorte novú faktúru</p>
      </div>
      <InvoiceForm mode="create" />
    </div>
  )
}

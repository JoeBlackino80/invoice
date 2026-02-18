"use client"

import { Breadcrumb } from "@/components/layout/breadcrumb"
import { QuoteForm } from "@/components/quotes/quote-form"

export default function NewQuotePage() {
  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Nová cenová ponuka</h1>
        <p className="text-muted-foreground">Vytvorte novú cenovú ponuku</p>
      </div>
      <QuoteForm mode="create" />
    </div>
  )
}

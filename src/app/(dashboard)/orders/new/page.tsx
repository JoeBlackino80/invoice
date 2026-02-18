"use client"

import { Breadcrumb } from "@/components/layout/breadcrumb"
import { OrderForm } from "@/components/orders/order-form"

export default function NewOrderPage() {
  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Nová objednávka</h1>
        <p className="text-muted-foreground">Vytvorte novú objednávku</p>
      </div>
      <OrderForm mode="create" />
    </div>
  )
}

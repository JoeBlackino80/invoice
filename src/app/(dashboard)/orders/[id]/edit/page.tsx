"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { OrderForm } from "@/components/orders/order-form"
import { Loader2 } from "lucide-react"

export default function EditOrderPage() {
  const params = useParams()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${params.id}`)
        if (res.ok) {
          const data = await res.json()
          setOrder(data)
        }
      } catch {
        // handled by UI
      } finally {
        setLoading(false)
      }
    }
    fetchOrder()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Objednávka nenájdená</p>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Objednávka {order.number}
        </h1>
        <p className="text-muted-foreground">
          {order.status === "nova" ? "Nová \u2013 môžete upravovať" : order.status === "vybavena" ? "Vybavená \u2013 len na čítanie" : order.status === "stornovana" ? "Stornovaná \u2013 len na čítanie" : "Upraviť objednávku"}
        </p>
      </div>
      <OrderForm order={order} mode="edit" />
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { InvoiceForm } from "@/components/invoices/invoice-form"
import { Loader2 } from "lucide-react"

export default function EditInvoicePage() {
  const params = useParams()
  const [invoice, setInvoice] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/invoices/${params.id}`)
        if (res.ok) {
          const data = await res.json()
          setInvoice(data)
          setItems(data.invoice_items || [])
        }
      } catch {
        // handled by UI
      } finally {
        setLoading(false)
      }
    }
    fetchInvoice()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Faktúra nenájdená</p>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Faktúra {invoice.number}
        </h1>
        <p className="text-muted-foreground">
          {invoice.status === "draft" ? "Koncept – môžete upravovať" : "Len na čítanie"}
        </p>
      </div>
      <InvoiceForm invoice={invoice} items={items} mode="edit" />
    </div>
  )
}

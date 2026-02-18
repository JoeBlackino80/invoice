"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { QuoteForm } from "@/components/quotes/quote-form"
import { Loader2 } from "lucide-react"

export default function EditQuotePage() {
  const params = useParams()
  const [quote, setQuote] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const res = await fetch(`/api/quotes/${params.id}`)
        if (res.ok) {
          const data = await res.json()
          setQuote(data)
        }
      } catch {
        // handled by UI
      } finally {
        setLoading(false)
      }
    }
    fetchQuote()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Cenová ponuka nenájdená</p>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Ponuka {quote.number}
        </h1>
        <p className="text-muted-foreground">
          {quote.status === "draft" ? "Koncept \u2013 môžete upravovať" : quote.status === "converted" ? "Konvertovaná \u2013 len na čítanie" : "Upraviť cenovú ponuku"}
        </p>
      </div>
      <QuoteForm quote={quote} mode="edit" />
    </div>
  )
}

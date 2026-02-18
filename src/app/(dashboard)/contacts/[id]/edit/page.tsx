"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { ContactForm } from "@/components/contacts/contact-form"
import { Loader2 } from "lucide-react"

export default function EditContactPage() {
  const params = useParams()
  const [contact, setContact] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const res = await fetch(`/api/contacts/${params.id}`)
        if (res.ok) {
          const data = await res.json()
          setContact(data)
        }
      } catch {
        // handled by UI
      } finally {
        setLoading(false)
      }
    }
    fetchContact()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Kontakt nebol nájdený</p>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Upraviť kontakt</h1>
        <p className="text-muted-foreground">{contact.name}</p>
      </div>
      <ContactForm contact={contact} mode="edit" />
    </div>
  )
}

"use client"

import { Breadcrumb } from "@/components/layout/breadcrumb"
import { ContactForm } from "@/components/contacts/contact-form"

export default function NewContactPage() {
  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Nový kontakt</h1>
        <p className="text-muted-foreground">Pridajte nového odberateľa alebo dodávateľa</p>
      </div>
      <ContactForm mode="create" />
    </div>
  )
}

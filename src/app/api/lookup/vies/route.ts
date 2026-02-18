import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Overenie IČ DPH cez VIES API (systém EÚ)
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const vatNumber = searchParams.get("vat_number")

  if (!vatNumber || vatNumber.length < 4) {
    return NextResponse.json({ error: "IČ DPH je povinné" }, { status: 400 })
  }

  const countryCode = vatNumber.substring(0, 2).toUpperCase()
  const number = vatNumber.substring(2)

  try {
    // VIES SOAP API
    const soapBody = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
        <soapenv:Body>
          <urn:checkVat>
            <urn:countryCode>${countryCode}</urn:countryCode>
            <urn:vatNumber>${number}</urn:vatNumber>
          </urn:checkVat>
        </soapenv:Body>
      </soapenv:Envelope>
    `

    const response = await fetch(
      "https://ec.europa.eu/taxation_customs/vies/services/checkVatService",
      {
        method: "POST",
        headers: {
          "Content-Type": "text/xml;charset=UTF-8",
          "SOAPAction": "",
        },
        body: soapBody,
      }
    )

    if (!response.ok) {
      return NextResponse.json({
        valid: false,
        message: "VIES služba nie je dostupná",
      })
    }

    const xml = await response.text()

    const validMatch = xml.match(/<ns2:valid>(\w+)<\/ns2:valid>/)
    const nameMatch = xml.match(/<ns2:name>([^<]*)<\/ns2:name>/)
    const addressMatch = xml.match(/<ns2:address>([^<]*)<\/ns2:address>/)

    const valid = validMatch ? validMatch[1] === "true" : false

    return NextResponse.json({
      valid,
      name: nameMatch ? nameMatch[1].trim() : null,
      address: addressMatch ? addressMatch[1].trim() : null,
      vat_number: vatNumber,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Chyba pri overovaní IČ DPH" },
      { status: 500 }
    )
  }
}

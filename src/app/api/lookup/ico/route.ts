import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Vyhľadanie firmy podľa IČO cez RPO (Register právnických osôb)
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const ico = searchParams.get("ico")

  if (!ico || ico.length < 6) {
    return NextResponse.json({ error: "IČO musí mať aspoň 6 číslic" }, { status: 400 })
  }

  try {
    // Pokus o vyhľadanie cez data.gov.sk RPO API
    const rpoResponse = await fetch(
      `https://data.gov.sk/api/action/organization_show?id=${ico}`,
      { next: { revalidate: 86400 } } // Cache na 24 hodín
    )

    if (rpoResponse.ok) {
      const rpoData = await rpoResponse.json()
      if (rpoData.success && rpoData.result) {
        const result = rpoData.result
        const name = result.title || result.name

        // Try to derive DIČ from IČO for Slovak companies
        // Slovak DIČ is typically a 10-digit number, often derived from IČO
        const cleanIco = ico.replace(/^0+/, "")
        const possibleDic = cleanIco.length <= 8 ? `20${cleanIco.padStart(8, "0")}` : null

        // Parse address if available
        let street = null
        let city = null
        let zip = null
        let country = "SK"

        if (result.address) {
          // Try parsing structured address
          const addr = result.address
          if (typeof addr === "object") {
            street = addr.street || addr.buildingName || null
            city = addr.municipality || addr.city || null
            zip = addr.postalCode || addr.zip || null
            country = addr.country || "SK"
          } else if (typeof addr === "string") {
            // Simple parsing of address string
            const parts = addr.split(",").map((p: string) => p.trim())
            if (parts.length >= 2) {
              street = parts[0]
              const cityZip = parts[parts.length - 1]
              const zipMatch = cityZip.match(/(\d{3}\s?\d{2})/)
              if (zipMatch) {
                zip = zipMatch[1]
                city = cityZip.replace(zipMatch[0], "").trim()
              } else {
                city = cityZip
              }
            }
          }
        }

        return NextResponse.json({
          name,
          ico: ico,
          dic: possibleDic,
          ic_dph: null,
          street,
          city,
          zip,
          country,
        })
      }
    }

    // Fallback: skúsiť FinStat alebo ORSR
    // Pre produkciu by sme použili ORSR API alebo FinStat API
    // Tu vrátime aspoň čisté IČO
    const orResponse = await fetch(
      `https://www.orsr.sk/hladaj_ico.asp?ICO=${ico}&SID=0&T=f0&R=on`,
      {
        headers: { "Accept": "text/html" },
        next: { revalidate: 86400 },
      }
    )

    if (orResponse.ok) {
      const html = await orResponse.text()
      // Jednoduchý parsing - v produkcii by sme použili ORSR API
      const nameMatch = html.match(/<td class="td1"[^>]*>([^<]+)<\/td>/)

      // Try to parse address from ORSR HTML
      let street = null
      let city = null
      let zip = null

      const addressMatch = html.match(/Sídlo[^<]*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i)
      if (addressMatch) {
        const addrParts = addressMatch[1].trim().split(",").map((p: string) => p.trim())
        if (addrParts.length >= 2) {
          street = addrParts[0]
          const lastPart = addrParts[addrParts.length - 1]
          const zipMatch = lastPart.match(/(\d{3}\s?\d{2})/)
          if (zipMatch) {
            zip = zipMatch[1]
            city = lastPart.replace(zipMatch[0], "").trim()
          } else {
            city = lastPart
          }
        }
      }

      if (nameMatch) {
        const cleanIco = ico.replace(/^0+/, "")
        const possibleDic = cleanIco.length <= 8 ? `20${cleanIco.padStart(8, "0")}` : null

        return NextResponse.json({
          name: nameMatch[1].trim(),
          ico: ico,
          dic: possibleDic,
          ic_dph: null,
          street,
          city,
          zip,
          country: "SK",
        })
      }
    }

    return NextResponse.json({
      name: null,
      ico: ico,
      dic: null,
      ic_dph: null,
      street: null,
      city: null,
      zip: null,
      country: null,
      message: "Firma nebola nájdená v registroch",
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Chyba pri vyhľadávaní v registroch" },
      { status: 500 }
    )
  }
}

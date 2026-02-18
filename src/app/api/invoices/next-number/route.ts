import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Map invoice type to sequence type (same mapping as POST /api/invoices)
const sequenceTypeMap: Record<string, string> = {
  vydana: "faktura_vydana",
  prijata: "faktura_prijata",
  zalohova: "zalohova_faktura",
  dobropis: "dobropis",
  proforma: "proforma",
}

// GET /api/invoices/next-number?company_id=X&type=Y
// Preview the next invoice number without incrementing the counter
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const type = searchParams.get("type")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  if (!type || !sequenceTypeMap[type]) {
    return NextResponse.json({ error: "Neplatný typ faktúry" }, { status: 400 })
  }

  const sequenceType = sequenceTypeMap[type]

  // Query the number_sequences table to preview the next number
  const { data: sequence, error } = await db
    .from("number_sequences")
    .select("prefix, current_number, format")
    .eq("company_id", companyId)
    .eq("type", sequenceType)
    .single()

  if (error || !sequence) {
    return NextResponse.json({ error: "Číselný rad nebol nájdený" }, { status: 404 })
  }

  // Calculate the next number (current_number + 1)
  const nextNumber = (sequence.current_number || 0) + 1
  const year = new Date().getFullYear()

  // Format the number based on the format string
  // format is like "{prefix}{year}{number:06}"
  let formattedNumber = (sequence.format || "{prefix}{year}{number:06}")
    .replace("{prefix}", sequence.prefix || "")
    .replace("{year}", year.toString())

  // Handle {number:XX} pattern where XX is the padding length
  const numberMatch = formattedNumber.match(/\{number:(\d+)\}/)
  if (numberMatch) {
    const padLength = parseInt(numberMatch[1])
    formattedNumber = formattedNumber.replace(
      numberMatch[0],
      nextNumber.toString().padStart(padLength, "0")
    )
  } else {
    formattedNumber = formattedNumber.replace("{number}", nextNumber.toString())
  }

  return NextResponse.json({ number: formattedNumber })
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateAgainstSchema } from "@/lib/edane/xml-validator"
import type { SchemaType } from "@/lib/edane/xml-validator"

const VALID_SCHEMA_TYPES: SchemaType[] = [
  "dph",
  "kvdph",
  "sv",
  "dppo",
  "dpfo",
  "mvp_sp",
  "zp_oznamenie",
  "ruz",
]

// POST /api/settings/e-dane/validate - Validate XML content against schema
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  const body = await request.json()
  const { xml, schema_type } = body

  if (!xml || xml.trim().length === 0) {
    return NextResponse.json(
      { error: "XML obsah je povinny" },
      { status: 400 }
    )
  }

  if (!schema_type || !VALID_SCHEMA_TYPES.includes(schema_type as SchemaType)) {
    return NextResponse.json(
      {
        error: `Neplatny typ schemy. Povolene: ${VALID_SCHEMA_TYPES.join(", ")}`,
      },
      { status: 400 }
    )
  }

  const result = validateAgainstSchema(xml, schema_type)

  return NextResponse.json(result)
}

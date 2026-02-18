import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateXLSX } from "@/lib/reports/xlsx-generator"

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neautorizovaný" }, { status: 401 })

  const body = await request.json()
  const { title, headers, rows, sheetName } = body

  if (!title || !headers || !rows) {
    return NextResponse.json({ error: "Chýbajúce parametre" }, { status: 400 })
  }

  try {
    const buffer = await generateXLSX(title, headers, rows, { sheetName })
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(title)}.xlsx"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

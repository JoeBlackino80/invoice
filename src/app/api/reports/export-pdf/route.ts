import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neautorizovaný" }, { status: 401 })

  // PDF export - use react-pdf/renderer
  // For now, return CSV as a simpler PDF alternative
  const body = await request.json()
  const { title, headers, rows } = body

  if (!title || !headers || !rows) {
    return NextResponse.json({ error: "Chýbajúce parametre" }, { status: 400 })
  }

  // Generate CSV with BOM for Slovak Excel
  const BOM = "\uFEFF"
  const csvRows = [headers.join(";"), ...rows.map((r: any[]) => r.map((c: any) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))]
  const csv = BOM + csvRows.join("\n")

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(title)}.csv"`,
    },
  })
}

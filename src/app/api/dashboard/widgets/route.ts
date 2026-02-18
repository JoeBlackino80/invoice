import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export interface WidgetConfig {
  id: string
  label: string
  visible: boolean
  order: number
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "quick-metrics", label: "Rýchle metriky", visible: true, order: 0 },
  { id: "revenue-chart", label: "Tržby", visible: true, order: 1 },
  { id: "expense-chart", label: "Náklady podľa kategórie", visible: true, order: 2 },
  { id: "cash-flow", label: "Cash flow", visible: true, order: 3 },
  { id: "vat-obligation", label: "DPH povinnosť", visible: true, order: 4 },
  { id: "account-balances", label: "Stav účtov", visible: true, order: 5 },
  { id: "upcoming-deadlines", label: "Blížiace sa termíny", visible: true, order: 6 },
  { id: "unpaid-invoices", label: "Neuhradené faktúry", visible: true, order: 7 },
  { id: "recent-activity", label: "Posledná aktivita", visible: true, order: 8 },
]

// GET /api/dashboard/widgets - Get widget configuration
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  // Try to fetch saved config from user_settings
  const { data: settings } = await (db.from("user_settings") as any)
    .select("value")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .eq("key", "dashboard_widgets")
    .single() as { data: any; error: any }

  if (settings?.value) {
    try {
      const parsed = typeof settings.value === "string" ? JSON.parse(settings.value) : settings.value
      return NextResponse.json({ widgets: parsed })
    } catch {
      // Fall through to default
    }
  }

  return NextResponse.json({ widgets: DEFAULT_WIDGETS })
}

// PUT /api/dashboard/widgets - Save widget configuration
export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, widgets } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  if (!widgets || !Array.isArray(widgets)) {
    return NextResponse.json({ error: "widgets musia byť pole" }, { status: 400 })
  }

  // Upsert widget config in user_settings
  const { error } = await (db.from("user_settings") as any)
    .upsert(
      {
        user_id: user.id,
        company_id,
        key: "dashboard_widgets",
        value: JSON.stringify(widgets),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,company_id,key" }
    )

  if (error) {
    // If user_settings table doesn't exist, store in localStorage (handled client-side)
    return NextResponse.json({ error: "Nepodarilo sa uložiť nastavenia" }, { status: 500 })
  }

  return NextResponse.json({ widgets, success: true })
}

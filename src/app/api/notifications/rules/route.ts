import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_NOTIFICATION_RULES } from "@/lib/notifications/notification-service"
import { notificationRuleSchema } from "@/lib/validations/notification"

// GET /api/notifications/rules - zoznam pravidiel notifikácií
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

  const { data: rules, error } = await (db.from("notification_rules") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("type")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Ak neexistujú pravidlá, vrátiť predvolené
  if (!rules || rules.length === 0) {
    const defaultRules = DEFAULT_NOTIFICATION_RULES.map((rule, index) => ({
      id: `default-${index}`,
      company_id: companyId,
      ...rule,
    }))
    return NextResponse.json({ data: defaultRules })
  }

  return NextResponse.json({ data: rules })
}

// PUT /api/notifications/rules - hromadná aktualizácia pravidiel
export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, rules } = body

  if (!company_id || !rules || !Array.isArray(rules)) {
    return NextResponse.json(
      { error: "Povinné polia: company_id, rules (pole)" },
      { status: 400 }
    )
  }

  // Validácia pravidiel
  for (const rule of rules) {
    const parsed = notificationRuleSchema.safeParse(rule)
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Neplatné pravidlo pre typ ${rule.type}: ${parsed.error.flatten().fieldErrors}` },
        { status: 400 }
      )
    }
  }

  // Vymazať existujúce pravidlá a vložiť nové
  const { error: deleteError } = await (db.from("notification_rules") as any)
    .delete()
    .eq("company_id", company_id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  const rulesToInsert = rules.map((rule: any) => ({
    company_id,
    type: rule.type,
    enabled: rule.enabled,
    channels: rule.channels,
    timing: rule.timing,
    recipients: rule.recipients,
  }))

  const { data: insertedRules, error: insertError } = await (db
    .from("notification_rules") as any)
    .insert(rulesToInsert)
    .select()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ data: insertedRules })
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { apiKeySchema } from "@/lib/validations/settings"

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let key = "sk_live_"
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return key
}

function maskApiKey(key: string): string {
  if (key.length <= 12) return key
  const prefix = key.substring(0, 8)
  const last4 = key.substring(key.length - 4)
  return `${prefix}****${last4}`
}

// GET /api/settings/api-keys - List API keys for company (masked)
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinne" }, { status: 400 })
  }

  // Verify user is admin
  const { data: role, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .single() as { data: any; error: any }

  if (roleError || !role || role.role !== "admin") {
    return NextResponse.json({ error: "Pristup zamietnuty - vyzaduje sa rola admin" }, { status: 403 })
  }

  const { data, error } = await (db
    .from("api_keys") as any)
    .select("*")
    .eq("company_id", companyId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Mask keys
  const masked = (data || []).map((item: any) => ({
    ...item,
    key: maskApiKey(item.key || ""),
  }))

  return NextResponse.json(masked)
}

// POST /api/settings/api-keys - Create new API key (return full key only once)
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...keyData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinne" }, { status: 400 })
  }

  // Verify user is admin
  const { data: role, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", company_id)
    .single() as { data: any; error: any }

  if (roleError || !role || role.role !== "admin") {
    return NextResponse.json({ error: "Pristup zamietnuty - vyzaduje sa rola admin" }, { status: 403 })
  }

  const parsed = apiKeySchema.safeParse(keyData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const fullKey = generateApiKey()

  const { data, error } = await (db
    .from("api_keys") as any)
    .insert({
      company_id,
      name: parsed.data.name,
      key: fullKey,
      permissions: parsed.data.permissions,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return full key only once
  return NextResponse.json({
    ...data,
    key: fullKey,
  }, { status: 201 })
}

// DELETE /api/settings/api-keys - Revoke API key
export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const companyId = searchParams.get("company_id")

  if (!id || !companyId) {
    return NextResponse.json({ error: "id a company_id su povinne" }, { status: 400 })
  }

  // Verify user is admin
  const { data: role, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .single() as { data: any; error: any }

  if (roleError || !role || role.role !== "admin") {
    return NextResponse.json({ error: "Pristup zamietnuty - vyzaduje sa rola admin" }, { status: 403 })
  }

  const { error } = await (db
    .from("api_keys") as any)
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

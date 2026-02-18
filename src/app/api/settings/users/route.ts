import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { userRoleSchema } from "@/lib/validations/settings"

// GET /api/settings/users - List users with roles for company
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

  // Verify user has access
  const { data: role, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .single() as { data: any; error: any }

  if (roleError || !role) {
    return NextResponse.json({ error: "Pristup zamietnuty" }, { status: 403 })
  }

  const { data, error } = await (db
    .from("user_company_roles") as any)
    .select(`
      id,
      user_id,
      role,
      created_at,
      user:users (
        id,
        email,
        raw_user_meta_data
      )
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Map to friendly format
  const users = (data || []).map((item: any) => ({
    id: item.id,
    user_id: item.user_id,
    email: item.user?.email || "",
    name: item.user?.raw_user_meta_data?.full_name || item.user?.raw_user_meta_data?.name || "",
    role: item.role,
    created_at: item.created_at,
  }))

  return NextResponse.json(users)
}

// POST /api/settings/users - Invite user (add to company with role)
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...userData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinne" }, { status: 400 })
  }

  // Verify user is admin
  const { data: currentRole, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", company_id)
    .single() as { data: any; error: any }

  if (roleError || !currentRole || currentRole.role !== "admin") {
    return NextResponse.json({ error: "Pristup zamietnuty - vyzaduje sa rola admin" }, { status: 403 })
  }

  const parsed = userRoleSchema.safeParse(userData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Find user by email
  const { data: targetUsers, error: findError } = await (db
    .from("users") as any)
    .select("id, email")
    .eq("email", parsed.data.user_email)
    .limit(1)

  if (findError || !targetUsers || targetUsers.length === 0) {
    return NextResponse.json({
      error: "Pouzivatel s tymto emailom nebol najdeny. Pouzivatel sa musi najskor zaregistrovat.",
    }, { status: 404 })
  }

  const targetUserId = targetUsers[0].id

  // Check if user already has role in this company
  const { data: existingRole } = await (db
    .from("user_company_roles") as any)
    .select("id")
    .eq("user_id", targetUserId)
    .eq("company_id", company_id)
    .single() as { data: any; error: any }

  if (existingRole) {
    return NextResponse.json({
      error: "Pouzivatel uz ma rolu v tejto firme",
    }, { status: 400 })
  }

  const { data, error } = await (db
    .from("user_company_roles") as any)
    .insert({
      user_id: targetUserId,
      company_id,
      role: parsed.data.role,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// PUT /api/settings/users - Update user role
export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { id, company_id, role } = body

  if (!id || !company_id || !role) {
    return NextResponse.json({ error: "id, company_id a role su povinne" }, { status: 400 })
  }

  // Verify user is admin
  const { data: currentRole, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", company_id)
    .single() as { data: any; error: any }

  if (roleError || !currentRole || currentRole.role !== "admin") {
    return NextResponse.json({ error: "Pristup zamietnuty - vyzaduje sa rola admin" }, { status: 403 })
  }

  const { data, error } = await (db
    .from("user_company_roles") as any)
    .update({ role })
    .eq("id", id)
    .eq("company_id", company_id)
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/settings/users - Remove user from company
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
  const { data: currentRole, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role, user_id")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .single() as { data: any; error: any }

  if (roleError || !currentRole || currentRole.role !== "admin") {
    return NextResponse.json({ error: "Pristup zamietnuty - vyzaduje sa rola admin" }, { status: 403 })
  }

  // Check if trying to remove self
  const { data: targetRole } = await (db
    .from("user_company_roles") as any)
    .select("user_id")
    .eq("id", id)
    .single() as { data: any; error: any }

  if (targetRole && targetRole.user_id === user.id) {
    return NextResponse.json({
      error: "Nemozno odstranit sameho seba z firmy",
    }, { status: 400 })
  }

  const { error } = await (db
    .from("user_company_roles") as any)
    .delete()
    .eq("id", id)
    .eq("company_id", companyId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

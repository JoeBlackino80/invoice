import type { SupabaseClient } from "@supabase/supabase-js"

// Typy notifikácií
export const NOTIFICATION_TYPES = [
  "invoice_overdue",
  "deadline_approaching",
  "invoice_approved",
  "payment_received",
  "ocr_processed",
  "low_stock",
  "bank_imported",
  "ai_anomaly",
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  invoice_overdue: "Faktúra po splatnosti",
  deadline_approaching: "Blížiaci sa termín",
  invoice_approved: "Faktúra schválená",
  payment_received: "Platba prijatá",
  ocr_processed: "OCR spracované",
  low_stock: "Nízke zásoby",
  bank_imported: "Bankový výpis importovaný",
  ai_anomaly: "AI anomália detekovaná",
}

export const NOTIFICATION_TYPE_DESCRIPTIONS: Record<NotificationType, string> = {
  invoice_overdue: "Upozornenie keď faktúra presiahne dátum splatnosti",
  deadline_approaching: "Upozornenie pred blížiacim sa termínom",
  invoice_approved: "Upozornenie keď je faktúra schválená",
  payment_received: "Upozornenie keď je platba prijatá",
  ocr_processed: "Upozornenie keď je OCR spracovanie dokončené",
  low_stock: "Upozornenie pri nízkych zásobách na sklade",
  bank_imported: "Upozornenie keď je bankový výpis importovaný",
  ai_anomaly: "Upozornenie keď AI detekuje anomáliu",
}

// Rozhrania
export interface Notification {
  id: string
  company_id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  link?: string
  is_read: boolean
  created_at: string
}

export interface NotificationRule {
  id: string
  company_id: string
  type: NotificationType
  enabled: boolean
  channels: {
    in_app: boolean
    email: boolean
  }
  timing: {
    days_before: number
    repeat_interval?: number
  }
  recipients: "all" | "admin" | "uctovnik" | "specific"
}

// Predvolené pravidlá notifikácií
export const DEFAULT_NOTIFICATION_RULES: Omit<NotificationRule, "id" | "company_id">[] = [
  {
    type: "invoice_overdue",
    enabled: true,
    channels: { in_app: true, email: true },
    timing: { days_before: 0, repeat_interval: 3 },
    recipients: "all",
  },
  {
    type: "deadline_approaching",
    enabled: true,
    channels: { in_app: true, email: false },
    timing: { days_before: 3, repeat_interval: undefined },
    recipients: "all",
  },
  {
    type: "invoice_approved",
    enabled: true,
    channels: { in_app: true, email: false },
    timing: { days_before: 0, repeat_interval: undefined },
    recipients: "all",
  },
  {
    type: "payment_received",
    enabled: true,
    channels: { in_app: true, email: true },
    timing: { days_before: 0, repeat_interval: undefined },
    recipients: "admin",
  },
  {
    type: "ocr_processed",
    enabled: true,
    channels: { in_app: true, email: false },
    timing: { days_before: 0, repeat_interval: undefined },
    recipients: "all",
  },
  {
    type: "low_stock",
    enabled: false,
    channels: { in_app: true, email: false },
    timing: { days_before: 0, repeat_interval: 7 },
    recipients: "admin",
  },
  {
    type: "bank_imported",
    enabled: true,
    channels: { in_app: true, email: false },
    timing: { days_before: 0, repeat_interval: undefined },
    recipients: "uctovnik",
  },
  {
    type: "ai_anomaly",
    enabled: true,
    channels: { in_app: true, email: true },
    timing: { days_before: 0, repeat_interval: undefined },
    recipients: "admin",
  },
]

// Funkcie služby notifikácií

export async function createNotification(
  supabase: SupabaseClient,
  notification: Omit<Notification, "id" | "created_at">
): Promise<Notification> {
  const { data, error } = await (supabase.from("notifications") as any)
    .insert({
      company_id: notification.company_id,
      user_id: notification.user_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link || null,
      is_read: notification.is_read,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    throw new Error(`Chyba pri vytváraní notifikácie: ${error.message}`)
  }

  return data as Notification
}

export async function getUnreadCount(
  supabase: SupabaseClient,
  userId: string,
  companyId: string
): Promise<number> {
  const { count, error } = await (supabase.from("notifications") as any)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("is_read", false) as { count: number | null; error: any }

  if (error) {
    throw new Error(`Chyba pri získavaní počtu neprečítaných: ${error.message}`)
  }

  return count ?? 0
}

export async function markAsRead(
  supabase: SupabaseClient,
  notificationId: string
): Promise<void> {
  const { error } = await (supabase.from("notifications") as any)
    .update({ is_read: true })
    .eq("id", notificationId)

  if (error) {
    throw new Error(`Chyba pri označovaní notifikácie: ${error.message}`)
  }
}

export async function markAllAsRead(
  supabase: SupabaseClient,
  userId: string,
  companyId: string
): Promise<void> {
  const { error } = await (supabase.from("notifications") as any)
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("is_read", false)

  if (error) {
    throw new Error(`Chyba pri označovaní všetkých notifikácií: ${error.message}`)
  }
}

export async function checkAndCreateOverdueNotifications(
  supabase: SupabaseClient,
  companyId: string
): Promise<void> {
  // Nájsť faktúry po splatnosti, ktoré nemajú ešte notifikáciu
  const today = new Date().toISOString().split("T")[0]

  const { data: overdueInvoices, error: invoiceError } = await (supabase
    .from("invoices") as any)
    .select("id, number, due_date, total_amount, contact:contacts(id, name)")
    .eq("company_id", companyId)
    .eq("status", "sent")
    .lt("due_date", today)
    .is("deleted_at", null)

  if (invoiceError || !overdueInvoices) {
    return
  }

  // Získať používateľov firmy
  const { data: companyUsers, error: usersError } = await (supabase
    .from("user_company_roles") as any)
    .select("user_id")
    .eq("company_id", companyId)

  if (usersError || !companyUsers) {
    return
  }

  for (const invoice of overdueInvoices as any[]) {
    const dueDate = new Date(invoice.due_date)
    const now = new Date()
    const daysPastDue = Math.floor(
      (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    const contactName = invoice.contact?.name || "Neznámy kontakt"

    // Skontrolovať, či notifikácia pre túto faktúru už existuje (za posledných 3 dní)
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const { data: existingNotif } = await (supabase
      .from("notifications") as any)
      .select("id")
      .eq("company_id", companyId)
      .eq("type", "invoice_overdue")
      .ilike("message", `%${invoice.number}%`)
      .gte("created_at", threeDaysAgo.toISOString())
      .limit(1) as { data: any; error: any }

    if (existingNotif && existingNotif.length > 0) {
      continue
    }

    // Vytvoriť notifikáciu pre každého používateľa
    for (const userRole of companyUsers as any[]) {
      await createNotification(supabase, {
        company_id: companyId,
        user_id: userRole.user_id,
        type: "invoice_overdue",
        title: "Faktúra po splatnosti",
        message: `Faktúra ${invoice.number} pre ${contactName} je ${daysPastDue} ${daysPastDue === 1 ? "deň" : daysPastDue < 5 ? "dni" : "dní"} po splatnosti.`,
        link: `/invoices/${invoice.id}`,
        is_read: false,
      })
    }
  }
}

export async function checkAndCreateLowStockNotifications(
  supabase: SupabaseClient,
  companyId: string
): Promise<number> {
  // Query products with stock below minimum
  const { data: products } = await (supabase.from("warehouse_products") as any)
    .select("id, name, sku, min_stock")
    .eq("company_id", companyId)
    .gt("min_stock", 0)
    .is("deleted_at", null)

  if (!products || products.length === 0) return 0

  let notificationsCreated = 0

  for (const product of products) {
    // Check stock level
    const { data: stockLevels } = await (supabase.from("warehouse_stock_levels") as any)
      .select("quantity")
      .eq("product_id", product.id)

    const totalStock = (stockLevels || []).reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0)

    if (totalStock < product.min_stock) {
      // Check if notification was already created in last 7 days
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const { data: existing } = await (supabase.from("notifications") as any)
        .select("id")
        .eq("company_id", companyId)
        .eq("type", "low_stock")
        .ilike("message", `%${product.name}%`)
        .gte("created_at", weekAgo)
        .limit(1)

      if (!existing || existing.length === 0) {
        await (supabase.from("notifications") as any).insert({
          company_id: companyId,
          type: "low_stock",
          title: "Nízke zásoby",
          message: `${product.name} (${product.sku || ""}) - zostatok ${totalStock}, minimum ${product.min_stock}`,
          link: "/warehouse/products",
        })
        notificationsCreated++
      }
    }
  }

  return notificationsCreated
}

export async function checkAndCreateDeadlineNotifications(
  supabase: SupabaseClient,
  companyId: string
): Promise<void> {
  // Nájsť faktúry s blížiacim sa termínom (3 dni pred splatnosťou)
  const today = new Date()
  const threeDaysLater = new Date()
  threeDaysLater.setDate(today.getDate() + 3)

  const todayStr = today.toISOString().split("T")[0]
  const futureStr = threeDaysLater.toISOString().split("T")[0]

  const { data: upcomingInvoices, error: invoiceError } = await (supabase
    .from("invoices") as any)
    .select("id, number, due_date, total_amount, contact:contacts(id, name)")
    .eq("company_id", companyId)
    .eq("status", "sent")
    .gte("due_date", todayStr)
    .lte("due_date", futureStr)
    .is("deleted_at", null)

  if (invoiceError || !upcomingInvoices) {
    return
  }

  // Získať používateľov firmy
  const { data: companyUsers, error: usersError } = await (supabase
    .from("user_company_roles") as any)
    .select("user_id")
    .eq("company_id", companyId)

  if (usersError || !companyUsers) {
    return
  }

  for (const invoice of upcomingInvoices as any[]) {
    const dueDate = new Date(invoice.due_date)
    const daysRemaining = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    const contactName = invoice.contact?.name || "Neznámy kontakt"

    // Skontrolovať, či notifikácia už existuje
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const { data: existingNotif } = await (supabase
      .from("notifications") as any)
      .select("id")
      .eq("company_id", companyId)
      .eq("type", "deadline_approaching")
      .ilike("message", `%${invoice.number}%`)
      .gte("created_at", oneDayAgo.toISOString())
      .limit(1) as { data: any; error: any }

    if (existingNotif && existingNotif.length > 0) {
      continue
    }

    for (const userRole of companyUsers as any[]) {
      await createNotification(supabase, {
        company_id: companyId,
        user_id: userRole.user_id,
        type: "deadline_approaching",
        title: "Blížiaci sa termín splatnosti",
        message: `Faktúra ${invoice.number} pre ${contactName} má splatnosť o ${daysRemaining} ${daysRemaining === 1 ? "deň" : daysRemaining < 5 ? "dni" : "dní"}.`,
        link: `/invoices/${invoice.id}`,
        is_read: false,
      })
    }
  }
}

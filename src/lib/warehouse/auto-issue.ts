// Automatická výdajka pri fakturácii
import type { SupabaseClient } from "@supabase/supabase-js"

interface AutoIssueResult {
  issued: boolean
  issueId?: string
  skippedProducts: string[]
  error?: string
}

/**
 * Vytvorí automatickú výdajku pre faktúru s produktmi
 */
export async function createAutoIssueForInvoice(
  db: SupabaseClient,
  invoiceId: string,
  companyId: string,
  items: Array<{ product_id: string | null; quantity: number; description: string }>,
  userId: string
): Promise<AutoIssueResult> {
  const productItems = items.filter((item) => item.product_id)

  if (productItems.length === 0) {
    return { issued: false, skippedProducts: [] }
  }

  try {
    // Nájsť default warehouse
    const { data: settings } = await (db.from("company_settings") as any)
      .select("default_warehouse_id")
      .eq("company_id", companyId)
      .single()

    let warehouseId = settings?.default_warehouse_id

    if (!warehouseId) {
      // Ak nie je nastavený, vezmeme prvý aktívny sklad
      const { data: warehouses } = await (db.from("warehouses") as any)
        .select("id")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .limit(1)

      warehouseId = warehouses?.[0]?.id
    }

    if (!warehouseId) {
      return { issued: false, skippedProducts: [], error: "Žiadny aktívny sklad" }
    }

    // Skontrolovať dostupnosť zásob
    const skippedProducts: string[] = []
    const validItems: Array<{ product_id: string; quantity: number; description: string }> = []

    for (const item of productItems) {
      if (!item.product_id) continue

      const { data: stock } = await (db.from("warehouse_stock_levels") as any)
        .select("quantity")
        .eq("warehouse_id", warehouseId)
        .eq("product_id", item.product_id)
        .single()

      const available = Number(stock?.quantity) || 0

      if (available >= item.quantity) {
        validItems.push({ product_id: item.product_id!, quantity: item.quantity, description: item.description })
      } else {
        skippedProducts.push(item.description || item.product_id!)
      }
    }

    if (validItems.length === 0) {
      return { issued: false, skippedProducts }
    }

    // Generovať číslo výdajky
    const year = new Date().getFullYear()
    const { data: lastIssue } = await (db.from("stock_issues") as any)
      .select("issue_number")
      .eq("company_id", companyId)
      .like("issue_number", `VYD${year}%`)
      .order("issue_number", { ascending: false })
      .limit(1)

    let seq = 1
    if (lastIssue && lastIssue.length > 0) {
      const numPart = parseInt(lastIssue[0].issue_number.replace(`VYD${year}`, ""), 10)
      if (!isNaN(numPart)) seq = numPart + 1
    }

    const issueNumber = `VYD${year}${String(seq).padStart(6, "0")}`

    // Vytvoriť výdajku
    const { data: issue, error: issueError } = await (db.from("stock_issues") as any)
      .insert({
        company_id: companyId,
        warehouse_id: warehouseId,
        issue_number: issueNumber,
        issue_date: new Date().toISOString().split("T")[0],
        reason: "fakturacia",
        invoice_id: invoiceId,
        notes: `Automatická výdajka k faktúre`,
        status: "confirmed",
        created_by: userId,
      })
      .select("id")
      .single()

    if (issueError || !issue) {
      return { issued: false, skippedProducts, error: issueError?.message || "Chyba pri vytváraní výdajky" }
    }

    // Vytvoriť položky výdajky a aktualizovať stavy
    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i]

      // Pridať položku
      await (db.from("stock_issue_items") as any).insert({
        stock_issue_id: issue.id,
        product_id: item.product_id,
        quantity: item.quantity,
        position: i + 1,
      })

      // Znížiť stav zásob
      const { data: currentStock } = await (db.from("warehouse_stock_levels") as any)
        .select("quantity")
        .eq("warehouse_id", warehouseId)
        .eq("product_id", item.product_id)
        .single()

      const newQty = Math.max(0, (Number(currentStock?.quantity) || 0) - item.quantity)

      await (db.from("warehouse_stock_levels") as any)
        .upsert({
          warehouse_id: warehouseId,
          product_id: item.product_id,
          quantity: newQty,
          updated_at: new Date().toISOString(),
        }, { onConflict: "warehouse_id,product_id" })
    }

    return { issued: true, issueId: issue.id, skippedProducts }
  } catch (err: any) {
    return { issued: false, skippedProducts: [], error: err.message }
  }
}

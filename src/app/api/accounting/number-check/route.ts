import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/accounting/number-check - kontrola súvislosti číslovania dokladov
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

  // Fetch all non-deleted journal entries grouped by document_type
  const { data: entries, error } = await (db.from("journal_entries") as any)
    .select("id, number, document_type, date, status")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("number", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by document_type
  const grouped: Record<string, any[]> = {}
  for (const entry of (entries || [])) {
    const type = entry.document_type || "UNKNOWN"
    if (!grouped[type]) grouped[type] = []
    grouped[type].push(entry)
  }

  const results = Object.entries(grouped).map(([docType, docEntries]) => {
    // Extract numeric parts from document numbers for gap detection
    const numbers: number[] = []
    const numberMap: Record<number, string> = {}

    for (const entry of docEntries) {
      if (!entry.number) continue
      // Try to extract numeric suffix from document number (e.g., "FA-2025-0001" -> 1)
      const match = entry.number.match(/(\d+)\s*$/)
      if (match) {
        const num = parseInt(match[1], 10)
        numbers.push(num)
        numberMap[num] = entry.number
      }
    }

    numbers.sort((a, b) => a - b)

    // Detect gaps
    const gaps: string[] = []
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] - numbers[i - 1] > 1) {
        const gapStart = numbers[i - 1] + 1
        const gapEnd = numbers[i] - 1
        if (gapStart === gapEnd) {
          gaps.push(`chýba č. ${gapStart}`)
        } else {
          gaps.push(`chýba č. ${gapStart} - ${gapEnd}`)
        }
      }
    }

    // Detect duplicates
    const duplicates: string[] = []
    const seen = new Set<number>()
    for (const num of numbers) {
      if (seen.has(num)) {
        duplicates.push(`duplicitné č. ${numberMap[num] || num}`)
      }
      seen.add(num)
    }

    const hasGaps = gaps.length > 0
    const hasDuplicates = duplicates.length > 0
    const hasIssues = hasGaps || hasDuplicates

    return {
      document_type: docType,
      count: docEntries.length,
      first_number: numbers.length > 0 ? numberMap[numbers[0]] || String(numbers[0]) : null,
      last_number: numbers.length > 0 ? numberMap[numbers[numbers.length - 1]] || String(numbers[numbers.length - 1]) : null,
      has_gaps: hasGaps,
      has_duplicates: hasDuplicates,
      has_issues: hasIssues,
      gaps,
      duplicates,
      details: [...gaps, ...duplicates],
    }
  })

  // Sort by document_type
  results.sort((a, b) => a.document_type.localeCompare(b.document_type))

  return NextResponse.json({
    data: results,
    checked_at: new Date().toISOString(),
  })
}

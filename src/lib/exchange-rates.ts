/**
 * Fetch real-time ECB exchange rates (EUR base).
 * Falls back to hardcoded rates if the ECB feed is unreachable.
 */
export async function fetchEcbRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
      { next: { revalidate: 3600 } } // cache for 1 hour in Next.js
    )
    const xml = await res.text()
    const rates: Record<string, number> = {}
    // Parse XML with regex - ECB format: <Cube currency='USD' rate='1.0856'/>
    const regex = /currency='([A-Z]+)'\s+rate='([\d.]+)'/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(xml)) !== null) {
      rates[match[1]] = parseFloat(match[2])
    }
    if (Object.keys(rates).length > 0) {
      return rates
    }
    // If parsing returned nothing, fall through to fallback
    throw new Error("No rates parsed from ECB XML")
  } catch {
    // Fallback rates
    return { USD: 1.08, GBP: 0.86, CZK: 25.3, PLN: 4.32, HUF: 395.0, CHF: 0.94 }
  }
}

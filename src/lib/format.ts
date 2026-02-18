// Slovenské formátovanie čísiel, meny a dátumov

/** Formátovanie sumy ako slovenská mena: "1 234,56 €" */
export function formatMoney(amount: number, currency: string = "EUR"): string {
  if (amount == null || isNaN(amount)) return "0,00 €"
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Formátovanie čísla so slovenským oddeľovačom: "1 234,56" */
export function formatNumber(value: number, decimals: number = 2): string {
  if (value == null || isNaN(value)) return "0"
  return new Intl.NumberFormat("sk-SK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Formátovanie dátumu: "15.02.2025" */
export function formatDate(dateStr: string | Date): string {
  if (!dateStr) return ""
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr
  if (isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

/** Formátovanie dátumu a času: "15.02.2025 14:30" */
export function formatDateTime(dateStr: string | Date): string {
  if (!dateStr) return ""
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr
  if (isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

/** Formátovanie percent: "12,5 %" */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${formatNumber(value, decimals)} %`
}

/** Formátovanie IČO: "12 345 678" */
export function formatICO(ico: string): string {
  if (!ico) return ""
  const clean = ico.replace(/\s/g, "")
  if (clean.length === 8) {
    return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5)}`
  }
  return ico
}

/** Relatívny čas: "pred 2 hodinami", "pred 3 dňami" */
export function formatRelativeTime(dateStr: string | Date): string {
  if (!dateStr) return ""
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "práve teraz"
  if (diffMin < 60) return `pred ${diffMin} min`
  if (diffHours < 24) return `pred ${diffHours} hod`
  if (diffDays < 7) return `pred ${diffDays} dňami`
  return formatDate(d)
}

// DPH termíny a výpočet deadlinov

export interface DPHDeadlineInfo {
  periodLabel: string
  periodFrom: string
  periodTo: string
  deadlineDate: string
  daysRemaining: number
  isOverdue: boolean
  warningLevel: "ok" | "warning" | "urgent" | "overdue"
}

// Slovenské štátne sviatky (stále dni)
const SLOVAK_HOLIDAYS: Array<[number, number]> = [
  [1, 1],   // Deň vzniku SR
  [1, 6],   // Traja králi
  [5, 1],   // Sviatok práce
  [5, 8],   // Deň víťazstva
  [7, 5],   // Cyril a Metod
  [8, 29],  // SNP
  [9, 1],   // Deň ústavy
  [9, 15],  // Sedembolestná
  [11, 1],  // Všetkých svätých
  [11, 17], // Deň boja za slobodu
  [12, 24], // Štedrý deň
  [12, 25], // 1. sviatok vianočný
  [12, 26], // 2. sviatok vianočný
]

function isHoliday(date: Date): boolean {
  const m = date.getMonth() + 1
  const d = date.getDate()
  // Veľká noc - zjednodušene preskočíme (piatok+pondelok okolo Easter)
  return SLOVAK_HOLIDAYS.some(([hm, hd]) => hm === m && hd === d)
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function nextBusinessDay(date: Date): Date {
  const result = new Date(date)
  while (isWeekend(result) || isHoliday(result)) {
    result.setDate(result.getDate() + 1)
  }
  return result
}

const MONTHS_SK = [
  "január", "február", "marec", "apríl", "máj", "jún",
  "júl", "august", "september", "október", "november", "december",
]

/**
 * Vypočíta najbližší DPH deadline
 */
export function calculateNextDPHDeadline(
  vatPeriod: "mesacne" | "stvrtrocne",
  today?: Date
): DPHDeadlineInfo {
  const now = today || new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed

  if (vatPeriod === "mesacne") {
    // Mesačný platca: DPH za mesiac M je splatné do 25. M+1
    // Nájdeme najbližší budúci deadline
    for (let offset = 0; offset <= 2; offset++) {
      const reportMonth = currentMonth - 1 + offset // mesiac za ktorý sa podáva
      const reportYear = reportMonth < 0 ? currentYear - 1 : currentYear
      const actualMonth = reportMonth < 0 ? reportMonth + 12 : reportMonth

      // Deadline: 25. nasledujúceho mesiaca
      const deadlineMonth = actualMonth + 1
      const deadlineYear = deadlineMonth > 11 ? reportYear + 1 : reportYear
      const deadlineMonthActual = deadlineMonth > 11 ? 0 : deadlineMonth

      const rawDeadline = new Date(deadlineYear, deadlineMonthActual, 25)
      const deadline = nextBusinessDay(rawDeadline)

      if (deadline.getTime() >= now.getTime() - 86400000 * 30) {
        const diffMs = deadline.getTime() - now.getTime()
        const daysRemaining = Math.ceil(diffMs / 86400000)

        const periodFrom = `${reportYear}-${String(actualMonth + 1).padStart(2, "0")}-01`
        const lastDay = new Date(reportYear, actualMonth + 1, 0).getDate()
        const periodTo = `${reportYear}-${String(actualMonth + 1).padStart(2, "0")}-${lastDay}`

        return {
          periodLabel: `${MONTHS_SK[actualMonth]} ${reportYear}`,
          periodFrom,
          periodTo,
          deadlineDate: deadline.toISOString().split("T")[0],
          daysRemaining,
          isOverdue: daysRemaining < 0,
          warningLevel: daysRemaining < 0 ? "overdue" : daysRemaining <= 3 ? "urgent" : daysRemaining <= 7 ? "warning" : "ok",
        }
      }
    }
  } else {
    // Štvrťročný platca: Q1→25.4, Q2→25.7, Q3→25.10, Q4→25.1
    const quarters = [
      { q: 1, months: [0, 1, 2], deadlineMonth: 3, label: "Q1" },
      { q: 2, months: [3, 4, 5], deadlineMonth: 6, label: "Q2" },
      { q: 3, months: [6, 7, 8], deadlineMonth: 9, label: "Q3" },
      { q: 4, months: [9, 10, 11], deadlineMonth: 0, label: "Q4" },
    ]

    for (const quarter of quarters) {
      const deadlineYear = quarter.q === 4 ? currentYear + 1 : currentYear
      const rawDeadline = new Date(deadlineYear, quarter.deadlineMonth, 25)
      const deadline = nextBusinessDay(rawDeadline)

      if (deadline.getTime() >= now.getTime() - 86400000 * 30) {
        const diffMs = deadline.getTime() - now.getTime()
        const daysRemaining = Math.ceil(diffMs / 86400000)
        const qYear = quarter.q === 4 && currentMonth < 3 ? currentYear - 1 : currentYear

        return {
          periodLabel: `${quarter.label} ${qYear}`,
          periodFrom: `${qYear}-${String(quarter.months[0] + 1).padStart(2, "0")}-01`,
          periodTo: `${qYear}-${String(quarter.months[2] + 1).padStart(2, "0")}-${new Date(qYear, quarter.months[2] + 1, 0).getDate()}`,
          deadlineDate: deadline.toISOString().split("T")[0],
          daysRemaining,
          isOverdue: daysRemaining < 0,
          warningLevel: daysRemaining < 0 ? "overdue" : daysRemaining <= 3 ? "urgent" : daysRemaining <= 7 ? "warning" : "ok",
        }
      }
    }
  }

  // Fallback
  return {
    periodLabel: `${MONTHS_SK[currentMonth]} ${currentYear}`,
    periodFrom: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`,
    periodTo: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-28`,
    deadlineDate: `${currentYear}-${String(currentMonth + 2).padStart(2, "0")}-25`,
    daysRemaining: 25,
    isOverdue: false,
    warningLevel: "ok",
  }
}

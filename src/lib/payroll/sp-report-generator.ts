// Generátor výkazov pre Sociálnu poisťovňu (SP)
// Mesačný výkaz poistného (MVP)

// ---- Typy ----

export interface SPReportEmployee {
  employee_id: string
  name: string
  rodne_cislo: string
  assessment_base: number
  nemocenske: {
    employee: number
    employer: number
  }
  starobne: {
    employee: number
    employer: number
  }
  invalidne: {
    employee: number
    employer: number
  }
  nezamestnanost: {
    employee: number
    employer: number
  }
  garancne: {
    employer: number
  }
  rezervny_fond: {
    employer: number
  }
  urazove: {
    employer: number
  }
  total_employee: number
  total_employer: number
  total: number
}

export interface SPReport {
  company: {
    name: string
    ico: string
    dic: string
    variabilny_symbol: string
    address: string
  }
  period: {
    month: number
    year: number
  }
  employees: SPReportEmployee[]
  totals: {
    total_assessment_base: number
    total_nemocenske_employee: number
    total_nemocenske_employer: number
    total_starobne_employee: number
    total_starobne_employer: number
    total_invalidne_employee: number
    total_invalidne_employer: number
    total_nezamestnanost_employee: number
    total_nezamestnanost_employer: number
    total_garancne_employer: number
    total_rezervny_fond_employer: number
    total_urazove_employer: number
    total_employee: number
    total_employer: number
    total: number
  }
  number_of_employees: number
  generated_at: string
}

// ---- Sadzby poistného 2024/2025 ----

const SP_RATES = {
  nemocenske: { employee: 0.014, employer: 0.014 },
  starobne: { employee: 0.04, employer: 0.14 },
  invalidne: { employee: 0.03, employer: 0.03 },
  nezamestnanost: { employee: 0.01, employer: 0.01 },
  garancne: { employer: 0.0025 },
  rezervny_fond: { employer: 0.0475 },
  urazove: { employer: 0.008 },
}

// ---- Pomocné funkcie ----

function roundTwo(n: number): number {
  return Math.round(n * 100) / 100
}

// ---- Generátor ----

/**
 * Generuje mesačný výkaz poistného pre Sociálnu poisťovňu
 */
export function generateSPReport(
  payrollItems: any[],
  employees: any[],
  company: any,
  period: { month: number; year: number }
): SPReport {
  // Filtrovať za obdobie
  const items = payrollItems.filter((item: any) => {
    const itemMonth = item.month ?? new Date(item.period_start || item.created_at).getMonth() + 1
    const itemYear = item.year ?? new Date(item.period_start || item.created_at).getFullYear()
    return itemMonth === period.month && itemYear === period.year
  })

  // Mapa zamestnancov pre rýchly prístup
  const employeeMap = new Map<string, any>()
  for (const emp of employees) {
    employeeMap.set(emp.id, emp)
  }

  const reportEmployees: SPReportEmployee[] = []

  // Zoskupiť podľa zamestnanca
  const grouped = new Map<string, any[]>()
  for (const item of items) {
    const empId = item.employee_id
    if (!grouped.has(empId)) {
      grouped.set(empId, [])
    }
    grouped.get(empId)!.push(item)
  }

  let totalAssessmentBase = 0
  let totalNemocEmp = 0
  let totalNemocEmr = 0
  let totalStarobEmp = 0
  let totalStarobEmr = 0
  let totalInvalEmp = 0
  let totalInvalEmr = 0
  let totalNezamEmp = 0
  let totalNezamEmr = 0
  let totalGarancEmr = 0
  let totalRezervEmr = 0
  let totalUrazEmr = 0
  let totalEmp = 0
  let totalEmr = 0

  const entries = Array.from(grouped.entries())
  for (const [empId, empItems] of entries) {
    const emp = employeeMap.get(empId)
    const firstName = emp?.first_name || emp?.name || empItems[0]?.first_name || empItems[0]?.name || ""
    const lastName = emp?.last_name || emp?.surname || empItems[0]?.last_name || empItems[0]?.surname || ""
    const rodneCislo = emp?.rodne_cislo || empItems[0]?.rodne_cislo || ""

    // Vymeriavací základ - hrubá mzda (total_gross includes surcharges)
    let assessmentBase = 0
    let storedEmpIns: any = null
    let storedEmrIns: any = null
    for (const item of empItems) {
      assessmentBase += Number(item.total_gross || item.gross_salary || item.gross_income || 0)
      // Use stored insurance breakdowns if available
      if (item.employee_insurance) storedEmpIns = item.employee_insurance
      if (item.employer_insurance) storedEmrIns = item.employer_insurance
    }

    // Use stored values from payroll calculation if available, otherwise recalculate
    const nemocEmp = storedEmpIns?.sickness != null ? Number(storedEmpIns.sickness) : roundTwo(assessmentBase * SP_RATES.nemocenske.employee)
    const nemocEmr = storedEmrIns?.sickness != null ? Number(storedEmrIns.sickness) : roundTwo(assessmentBase * SP_RATES.nemocenske.employer)
    const starobEmp = storedEmpIns?.retirement != null ? Number(storedEmpIns.retirement) : roundTwo(assessmentBase * SP_RATES.starobne.employee)
    const starobEmr = storedEmrIns?.retirement != null ? Number(storedEmrIns.retirement) : roundTwo(assessmentBase * SP_RATES.starobne.employer)
    const invalEmp = storedEmpIns?.disability != null ? Number(storedEmpIns.disability) : roundTwo(assessmentBase * SP_RATES.invalidne.employee)
    const invalEmr = storedEmrIns?.disability != null ? Number(storedEmrIns.disability) : roundTwo(assessmentBase * SP_RATES.invalidne.employer)
    const nezamEmp = storedEmpIns?.unemployment != null ? Number(storedEmpIns.unemployment) : roundTwo(assessmentBase * SP_RATES.nezamestnanost.employee)
    const nezamEmr = storedEmrIns?.unemployment != null ? Number(storedEmrIns.unemployment) : roundTwo(assessmentBase * SP_RATES.nezamestnanost.employer)
    const garancEmr = storedEmrIns?.guarantee != null ? Number(storedEmrIns.guarantee) : roundTwo(assessmentBase * SP_RATES.garancne.employer)
    const rezervEmr = storedEmrIns?.reserve != null ? Number(storedEmrIns.reserve) : roundTwo(assessmentBase * SP_RATES.rezervny_fond.employer)
    const urazEmr = storedEmrIns?.accident != null ? Number(storedEmrIns.accident) : roundTwo(assessmentBase * SP_RATES.urazove.employer)

    const empTotal = roundTwo(nemocEmp + starobEmp + invalEmp + nezamEmp)
    const emrTotal = roundTwo(nemocEmr + starobEmr + invalEmr + nezamEmr + garancEmr + rezervEmr + urazEmr)

    reportEmployees.push({
      employee_id: empId,
      name: `${lastName} ${firstName}`.trim() || `Zamestnanec ${empId.substring(0, 8)}`,
      rodne_cislo: rodneCislo,
      assessment_base: roundTwo(assessmentBase),
      nemocenske: { employee: nemocEmp, employer: nemocEmr },
      starobne: { employee: starobEmp, employer: starobEmr },
      invalidne: { employee: invalEmp, employer: invalEmr },
      nezamestnanost: { employee: nezamEmp, employer: nezamEmr },
      garancne: { employer: garancEmr },
      rezervny_fond: { employer: rezervEmr },
      urazove: { employer: urazEmr },
      total_employee: empTotal,
      total_employer: emrTotal,
      total: roundTwo(empTotal + emrTotal),
    })

    totalAssessmentBase += assessmentBase
    totalNemocEmp += nemocEmp
    totalNemocEmr += nemocEmr
    totalStarobEmp += starobEmp
    totalStarobEmr += starobEmr
    totalInvalEmp += invalEmp
    totalInvalEmr += invalEmr
    totalNezamEmp += nezamEmp
    totalNezamEmr += nezamEmr
    totalGarancEmr += garancEmr
    totalRezervEmr += rezervEmr
    totalUrazEmr += urazEmr
    totalEmp += empTotal
    totalEmr += emrTotal
  }

  // Zoradiť podľa mena
  reportEmployees.sort((a, b) => a.name.localeCompare(b.name, "sk"))

  return {
    company: {
      name: company?.name || "",
      ico: company?.ico || "",
      dic: company?.dic || "",
      variabilny_symbol: company?.sp_variabilny_symbol || company?.ico || "",
      address: [company?.street, company?.city, company?.zip].filter(Boolean).join(", "),
    },
    period,
    employees: reportEmployees,
    totals: {
      total_assessment_base: roundTwo(totalAssessmentBase),
      total_nemocenske_employee: roundTwo(totalNemocEmp),
      total_nemocenske_employer: roundTwo(totalNemocEmr),
      total_starobne_employee: roundTwo(totalStarobEmp),
      total_starobne_employer: roundTwo(totalStarobEmr),
      total_invalidne_employee: roundTwo(totalInvalEmp),
      total_invalidne_employer: roundTwo(totalInvalEmr),
      total_nezamestnanost_employee: roundTwo(totalNezamEmp),
      total_nezamestnanost_employer: roundTwo(totalNezamEmr),
      total_garancne_employer: roundTwo(totalGarancEmr),
      total_rezervny_fond_employer: roundTwo(totalRezervEmr),
      total_urazove_employer: roundTwo(totalUrazEmr),
      total_employee: roundTwo(totalEmp),
      total_employer: roundTwo(totalEmr),
      total: roundTwo(totalEmp + totalEmr),
    },
    number_of_employees: reportEmployees.length,
    generated_at: new Date().toISOString(),
  }
}
/**
 * Generuje XML v formate pre Socialnu poistovnu (MVP)
 * Aktualizovane pre schema 2025
 */
export function generateSPReportXML(report: SPReport): string {
  const pad2 = (n: number) => n.toString().padStart(2, "0")
  const fmt = (n: number) => n.toFixed(2)
  const periodStr = `${report.period.year}-${pad2(report.period.month)}`

  const L: string[] = []

  L.push('<?xml version="1.0" encoding="UTF-8"?>')
  L.push('<dokument xmlns="http://www.socpoist.sk/mvp/2025">')
  L.push('  <hlavicka>')
  L.push(`    <ico>${escapeXml(report.company.ico)}</ico>`)
  L.push(`    <dic>${escapeXml(report.company.dic)}</dic>`)
  L.push(`    <nazov>${escapeXml(report.company.name)}</nazov>`)
  L.push(`    <adresa>${escapeXml(report.company.address)}</adresa>`)
  L.push(`    <variabilnySymbol>${escapeXml(report.company.variabilny_symbol)}</variabilnySymbol>`)
  L.push(`    <obdobie>${periodStr}</obdobie>`)
  L.push(`    <rok>${report.period.year}</rok>`)
  L.push(`    <mesiac>${pad2(report.period.month)}</mesiac>`)
  L.push(`    <pocetZamestnancov>${report.number_of_employees}</pocetZamestnancov>`)
  L.push(`    <datumVytvorenia>${report.generated_at}</datumVytvorenia>`)
  L.push('  </hlavicka>')
  L.push('  <zamestnanci>')

  for (const emp of report.employees) {
    L.push('    <zamestnanec>')
    L.push(`      <rodneCislo>${escapeXml(emp.rodne_cislo)}</rodneCislo>`)
    L.push(`      <meno>${escapeXml(emp.name)}</meno>`)
    L.push(`      <vymeriavaciZaklad>${fmt(emp.assessment_base)}</vymeriavaciZaklad>`)
    L.push('      <odvody>')
    L.push(`        <nemocenskeZam>${fmt(emp.nemocenske.employee)}</nemocenskeZam>`)
    L.push(`        <nemocenskeZav>${fmt(emp.nemocenske.employer)}</nemocenskeZav>`)
    L.push(`        <starobneZam>${fmt(emp.starobne.employee)}</starobneZam>`)
    L.push(`        <starobneZav>${fmt(emp.starobne.employer)}</starobneZav>`)
    L.push(`        <invalidneZam>${fmt(emp.invalidne.employee)}</invalidneZam>`)
    L.push(`        <invalidneZav>${fmt(emp.invalidne.employer)}</invalidneZav>`)
    L.push(`        <nezamestnanostZam>${fmt(emp.nezamestnanost.employee)}</nezamestnanostZam>`)
    L.push(`        <nezamestnanostZav>${fmt(emp.nezamestnanost.employer)}</nezamestnanostZav>`)
    L.push(`        <garancneZav>${fmt(emp.garancne.employer)}</garancneZav>`)
    L.push(`        <rezervnyFondZav>${fmt(emp.rezervny_fond.employer)}</rezervnyFondZav>`)
    L.push(`        <urazoveZav>${fmt(emp.urazove.employer)}</urazoveZav>`)
    L.push('      </odvody>')
    L.push(`      <spoluZamestnanec>${fmt(emp.total_employee)}</spoluZamestnanec>`)
    L.push(`      <spoluZamestnavatel>${fmt(emp.total_employer)}</spoluZamestnavatel>`)
    L.push(`      <spolu>${fmt(emp.total)}</spolu>`)
    L.push('    </zamestnanec>')
  }

  L.push('  </zamestnanci>')
  L.push('  <suhrn>')
  L.push(`    <celkovyVymeriavaciZaklad>${fmt(report.totals.total_assessment_base)}</celkovyVymeriavaciZaklad>`)
  L.push(`    <celkomZamestnanec>${fmt(report.totals.total_employee)}</celkomZamestnanec>`)
  L.push(`    <celkomZamestnavatel>${fmt(report.totals.total_employer)}</celkomZamestnavatel>`)
  L.push(`    <celkom>${fmt(report.totals.total)}</celkom>`)
  L.push('  </suhrn>')
  L.push('</dokument>')

  return L.join("\n")
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

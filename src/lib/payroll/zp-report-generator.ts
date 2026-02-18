// Generátor výkazov pre zdravotné poisťovne (ZP)
// Mesačné oznámenie platiteľa poistného

// ---- Typy ----

export interface ZPReportEmployee {
  employee_id: string
  name: string
  rodne_cislo: string
  insurer: string
  insurer_code: string
  assessment_base: number
  insurance_employee: number
  insurance_employer: number
  insurance_total: number
}

export interface ZPReportInsurerGroup {
  insurer: string
  insurer_code: string
  employees: ZPReportEmployee[]
  totals: {
    total_assessment_base: number
    total_insurance_employee: number
    total_insurance_employer: number
    total_insurance: number
  }
  number_of_employees: number
}

export interface ZPReport {
  company: {
    name: string
    ico: string
    dic: string
    address: string
  }
  period: {
    month: number
    year: number
  }
  insurers: ZPReportInsurerGroup[]
  totals: {
    total_assessment_base: number
    total_insurance_employee: number
    total_insurance_employer: number
    total_insurance: number
  }
  number_of_employees: number
  generated_at: string
}

// ---- Sadzby zdravotného poistenia ----

const ZP_RATES = {
  employee: 0.04,
  employer: 0.10,
}

// ---- Kódy poisťovní ----

export const ZP_INSURERS: Record<string, { name: string; code: string }> = {
  vszp: { name: "Všeobecná zdravotná poisťovňa", code: "24" },
  dovera: { name: "Dôvera zdravotná poisťovňa", code: "25" },
  union: { name: "Union zdravotná poisťovňa", code: "27" },
}

// ---- Pomocné funkcie ----

function roundTwo(n: number): number {
  return Math.round(n * 100) / 100
}

function resolveInsurer(emp: any): { insurer: string; code: string } {
  const raw = (emp?.health_insurance || emp?.insurer || emp?.zp || "vszp").toLowerCase()
  if (raw.includes("dover") || raw === "25" || raw === "dovera") {
    return { insurer: "Dôvera", code: "25" }
  }
  if (raw.includes("union") || raw === "27") {
    return { insurer: "Union", code: "27" }
  }
  // Default VšZP
  return { insurer: "VšZP", code: "24" }
}

// ---- Generátor ----

/**
 * Generuje mesačné oznámenie platiteľa pre zdravotné poisťovne
 */
export function generateZPReport(
  payrollItems: any[],
  employees: any[],
  company: any,
  period: { month: number; year: number }
): ZPReport {
  // Filtrovať za obdobie
  const items = payrollItems.filter((item: any) => {
    const itemMonth = item.month ?? new Date(item.period_start || item.created_at).getMonth() + 1
    const itemYear = item.year ?? new Date(item.period_start || item.created_at).getFullYear()
    return itemMonth === period.month && itemYear === period.year
  })

  // Mapa zamestnancov
  const employeeMap = new Map<string, any>()
  for (const emp of employees) {
    employeeMap.set(emp.id, emp)
  }

  // Zoskupiť podľa zamestnanca
  const grouped = new Map<string, any[]>()
  for (const item of items) {
    const empId = item.employee_id
    if (!grouped.has(empId)) {
      grouped.set(empId, [])
    }
    grouped.get(empId)!.push(item)
  }

  const allEmployeeRecords: ZPReportEmployee[] = []
  const entries = Array.from(grouped.entries())

  for (const [empId, empItems] of entries) {
    const emp = employeeMap.get(empId)
    const firstName = emp?.first_name || emp?.name || empItems[0]?.first_name || empItems[0]?.name || ""
    const lastName = emp?.last_name || emp?.surname || empItems[0]?.last_name || empItems[0]?.surname || ""
    const rodneCislo = emp?.rodne_cislo || empItems[0]?.rodne_cislo || ""
    const { insurer, code } = resolveInsurer(emp || empItems[0])

    let assessmentBase = 0
    let storedEmpHealth: number | null = null
    let storedEmrHealth: number | null = null
    for (const item of empItems) {
      assessmentBase += Number(item.total_gross || item.gross_salary || item.gross_income || 0)
      // Use stored health insurance values if available
      if (item.employee_insurance?.health != null) storedEmpHealth = Number(item.employee_insurance.health)
      if (item.employer_insurance?.health != null) storedEmrHealth = Number(item.employer_insurance.health)
    }

    const insuranceEmployee = storedEmpHealth != null ? storedEmpHealth : roundTwo(assessmentBase * ZP_RATES.employee)
    const insuranceEmployer = storedEmrHealth != null ? storedEmrHealth : roundTwo(assessmentBase * ZP_RATES.employer)

    allEmployeeRecords.push({
      employee_id: empId,
      name: `${lastName} ${firstName}`.trim() || `Zamestnanec ${empId.substring(0, 8)}`,
      rodne_cislo: rodneCislo,
      insurer,
      insurer_code: code,
      assessment_base: roundTwo(assessmentBase),
      insurance_employee: insuranceEmployee,
      insurance_employer: insuranceEmployer,
      insurance_total: roundTwo(insuranceEmployee + insuranceEmployer),
    })
  }

  // Zoskupiť podľa poisťovne
  const insurerGroupMap = new Map<string, ZPReportEmployee[]>()
  for (const rec of allEmployeeRecords) {
    const key = rec.insurer_code
    if (!insurerGroupMap.has(key)) {
      insurerGroupMap.set(key, [])
    }
    insurerGroupMap.get(key)!.push(rec)
  }

  const insurers: ZPReportInsurerGroup[] = []
  let grandTotalBase = 0
  let grandTotalEmp = 0
  let grandTotalEmr = 0
  let grandTotal = 0

  const insurerEntries = Array.from(insurerGroupMap.entries())
  for (const [code, emps] of insurerEntries) {
    // Zoradiť podľa mena
    emps.sort((a, b) => a.name.localeCompare(b.name, "sk"))

    let totalBase = 0
    let totalEmp = 0
    let totalEmr = 0
    let total = 0

    for (const e of emps) {
      totalBase += e.assessment_base
      totalEmp += e.insurance_employee
      totalEmr += e.insurance_employer
      total += e.insurance_total
    }

    const insurerName = code === "24" ? "VšZP" : code === "25" ? "Dôvera" : code === "27" ? "Union" : code

    insurers.push({
      insurer: insurerName,
      insurer_code: code,
      employees: emps,
      totals: {
        total_assessment_base: roundTwo(totalBase),
        total_insurance_employee: roundTwo(totalEmp),
        total_insurance_employer: roundTwo(totalEmr),
        total_insurance: roundTwo(total),
      },
      number_of_employees: emps.length,
    })

    grandTotalBase += totalBase
    grandTotalEmp += totalEmp
    grandTotalEmr += totalEmr
    grandTotal += total
  }

  // Zoradiť poisťovne podľa kódu
  insurers.sort((a, b) => a.insurer_code.localeCompare(b.insurer_code))

  return {
    company: {
      name: company?.name || "",
      ico: company?.ico || "",
      dic: company?.dic || "",
      address: [company?.street, company?.city, company?.zip].filter(Boolean).join(", "),
    },
    period,
    insurers,
    totals: {
      total_assessment_base: roundTwo(grandTotalBase),
      total_insurance_employee: roundTwo(grandTotalEmp),
      total_insurance_employer: roundTwo(grandTotalEmr),
      total_insurance: roundTwo(grandTotal),
    },
    number_of_employees: allEmployeeRecords.length,
    generated_at: new Date().toISOString(),
  }
}
/**
 * Generuje XML v formate pre zdravotnu poistovnu
 * Aktualizovane pre schema 2025
 */
export function generateZPReportXML(report: ZPReport, insurer: string): string {
  const group = report.insurers.find(
    (g) =>
      g.insurer_code === insurer ||
      g.insurer.toLowerCase() === insurer.toLowerCase()
  )

  if (!group) {
    return generateEmptyZPXML(report, insurer)
  }

  const pad2 = (n: number) => n.toString().padStart(2, "0")
  const fmt = (n: number) => n.toFixed(2)
  const periodStr = `${report.period.year}-${pad2(report.period.month)}`

  const L: string[] = []

  L.push('<?xml version="1.0" encoding="UTF-8"?>')
  L.push('<dokument xmlns="http://www.nfrsr.sk/zp/2025">')
  L.push('  <hlavicka>')
  L.push(`    <ico>${escapeXml(report.company.ico)}</ico>`)
  L.push(`    <dic>${escapeXml(report.company.dic)}</dic>`)
  L.push(`    <nazov>${escapeXml(report.company.name)}</nazov>`)
  L.push(`    <adresa>${escapeXml(report.company.address)}</adresa>`)
  L.push(`    <kodPoistovne>${escapeXml(group.insurer_code)}</kodPoistovne>`)
  L.push(`    <nazovPoistovne>${escapeXml(group.insurer)}</nazovPoistovne>`)
  L.push(`    <obdobie>${periodStr}</obdobie>`)
  L.push(`    <rok>${report.period.year}</rok>`)
  L.push(`    <mesiac>${pad2(report.period.month)}</mesiac>`)
  L.push(`    <pocetZamestnancov>${group.number_of_employees}</pocetZamestnancov>`)
  L.push(`    <datumVytvorenia>${report.generated_at}</datumVytvorenia>`)
  L.push('  </hlavicka>')
  L.push('  <zamestnanci>')

  for (const emp of group.employees) {
    L.push('    <zamestnanec>')
    L.push(`      <rodneCislo>${escapeXml(emp.rodne_cislo)}</rodneCislo>`)
    L.push(`      <meno>${escapeXml(emp.name)}</meno>`)
    L.push(`      <vymeriavaciZaklad>${fmt(emp.assessment_base)}</vymeriavaciZaklad>`)
    L.push(`      <poistneZamestnanec>${fmt(emp.insurance_employee)}</poistneZamestnanec>`)
    L.push(`      <poistneZamestnavatel>${fmt(emp.insurance_employer)}</poistneZamestnavatel>`)
    L.push(`      <poistneSpolu>${fmt(emp.insurance_total)}</poistneSpolu>`)
    L.push('    </zamestnanec>')
  }

  L.push('  </zamestnanci>')
  L.push('  <suhrn>')
  L.push(`    <celkovyVymeriavaciZaklad>${fmt(group.totals.total_assessment_base)}</celkovyVymeriavaciZaklad>`)
  L.push(`    <celkomZamestnanec>${fmt(group.totals.total_insurance_employee)}</celkomZamestnanec>`)
  L.push(`    <celkomZamestnavatel>${fmt(group.totals.total_insurance_employer)}</celkomZamestnavatel>`)
  L.push(`    <celkom>${fmt(group.totals.total_insurance)}</celkom>`)
  L.push('  </suhrn>')
  L.push('</dokument>')

  return L.join("\n")
}

function generateEmptyZPXML(report: ZPReport, insurer: string): string {
  const pad2 = (n: number) => n.toString().padStart(2, "0")
  const periodStr = `${report.period.year}-${pad2(report.period.month)}`

  const L: string[] = []

  L.push('<?xml version="1.0" encoding="UTF-8"?>')
  L.push('<dokument xmlns="http://www.nfrsr.sk/zp/2025">')
  L.push('  <hlavicka>')
  L.push(`    <ico>${escapeXml(report.company.ico)}</ico>`)
  L.push(`    <dic>${escapeXml(report.company.dic)}</dic>`)
  L.push(`    <nazov>${escapeXml(report.company.name)}</nazov>`)
  L.push(`    <adresa>${escapeXml(report.company.address)}</adresa>`)
  L.push(`    <kodPoistovne>${escapeXml(insurer)}</kodPoistovne>`)
  L.push(`    <obdobie>${periodStr}</obdobie>`)
  L.push(`    <rok>${report.period.year}</rok>`)
  L.push(`    <mesiac>${pad2(report.period.month)}</mesiac>`)
  L.push(`    <pocetZamestnancov>0</pocetZamestnancov>`)
  L.push(`    <datumVytvorenia>${report.generated_at}</datumVytvorenia>`)
  L.push('  </hlavicka>')
  L.push('  <zamestnanci />')
  L.push('  <suhrn>')
  L.push('    <celkovyVymeriavaciZaklad>0.00</celkovyVymeriavaciZaklad>')
  L.push('    <celkomZamestnanec>0.00</celkomZamestnanec>')
  L.push('    <celkomZamestnavatel>0.00</celkomZamestnavatel>')
  L.push('    <celkom>0.00</celkom>')
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

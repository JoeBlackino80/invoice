// =============================================================================
// Export Generation Library
// Generovanie CSV, auditorských balíkov a štatistických výkazov
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditorSection {
  key: string
  title: string
  headers: string[]
  rows: any[][]
}

export interface AuditorPackageData {
  companyName: string
  fiscalYear: string
  generatedAt: string
  sections: AuditorSection[]
}

export interface QuarterlyStatReport {
  company: string
  ico: string
  year: number
  quarter: number
  generatedAt: string
  trzby_vlastne_vykony: number
  trzby_tovar: number
  trzby_spolu: number
  naklady_hospodarsku_cinnost: number
  vysledok_hospodarenia: number
  priemerny_pocet_zamestnancov: number
  mzdove_naklady: number
  investicie: number
  odpisy: number
}

export interface AnnualStatReport {
  company: string
  ico: string
  fiscalYear: string
  generatedAt: string
  balanceSheet: {
    aktiva_spolu: number
    neobezny_majetok: number
    obezny_majetok: number
    casove_rozlisenie_aktiv: number
    pasiva_spolu: number
    vlastne_imanie: number
    zavazky: number
    casove_rozlisenie_pasiv: number
  }
  profitLoss: {
    trzby_predaj_tovaru: number
    naklady_obstaranie_tovaru: number
    obchodna_marza: number
    vyroby: number
    vyrobna_spotreba: number
    pridana_hodnota: number
    osobne_naklady: number
    odpisy: number
    prevadzkovy_vysledok: number
    financny_vysledok: number
    vysledok_pred_zdanenim: number
    dan_z_prijmov: number
    vysledok_po_zdaneni: number
  }
  statistics: {
    priemerny_pocet_zamestnancov: number
    osobne_naklady: number
    odpisy: number
    trzby_podla_odvetvia: Array<{ odvetvie: string; suma: number }>
  }
}

// ---------------------------------------------------------------------------
// CSV Generator
// ---------------------------------------------------------------------------

/**
 * Generate CSV string with UTF-8 BOM for proper encoding in Slovak Excel
 */
export function generateCSV(
  headers: string[],
  rows: any[][],
  delimiter: string = ";"
): string {
  const BOM = "\uFEFF"

  const escapeCsvField = (field: any): string => {
    if (field === null || field === undefined) return ""
    const str = String(field)
    // Escape if contains delimiter, quotes, or newlines
    if (
      str.includes(delimiter) ||
      str.includes('"') ||
      str.includes("\n") ||
      str.includes("\r")
    ) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }

  const headerLine = headers.map(escapeCsvField).join(delimiter)
  const dataLines = rows.map((row) =>
    row.map(escapeCsvField).join(delimiter)
  )

  return BOM + [headerLine, ...dataLines].join("\r\n")
}

// ---------------------------------------------------------------------------
// Auditor Export
// ---------------------------------------------------------------------------

export async function generateAuditorPackage(
  companyId: string,
  fiscalYearId: string,
  supabase: any
): Promise<AuditorPackageData> {
  // Fetch company info
  const { data: company } = await (supabase.from("companies") as any)
    .select("id, name, ico, dic")
    .eq("id", companyId)
    .single() as { data: any; error: any }

  // Fetch fiscal year info
  const { data: fiscalYear } = await (supabase.from("fiscal_years") as any)
    .select("id, name, start_date, end_date")
    .eq("id", fiscalYearId)
    .single() as { data: any; error: any }

  const companyName = company?.name || "Neznama firma"
  const fyName = fiscalYear
    ? `${fiscalYear.start_date} - ${fiscalYear.end_date}`
    : "Neznamy rok"
  const dateFrom = fiscalYear?.start_date || "2024-01-01"
  const dateTo = fiscalYear?.end_date || "2024-12-31"

  const sections: AuditorSection[] = []

  // 1. Chart of Accounts (Uctovy rozvrh)
  const { data: accounts } = await (supabase.from("chart_of_accounts") as any)
    .select("synteticky_ucet, analyticky_ucet, nazov, typ, aktivny")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("synteticky_ucet")
    .order("analyticky_ucet")

  if (accounts && accounts.length > 0) {
    sections.push({
      key: "chart_of_accounts",
      title: "Uctovy rozvrh",
      headers: [
        "Synteticky ucet",
        "Analyticky ucet",
        "Nazov",
        "Typ",
        "Aktivny",
      ],
      rows: accounts.map((a: any) => [
        a.synteticky_ucet,
        a.analyticky_ucet || "",
        a.nazov,
        a.typ,
        a.aktivny ? "Ano" : "Nie",
      ]),
    })
  }

  // 2. Journal Entries (Uctovne zapisy - dennik)
  const { data: entries } = await (supabase.from("journal_entries") as any)
    .select(
      `
      number,
      date,
      document_type,
      description,
      status,
      total_md,
      total_d,
      lines:journal_entry_lines(
        account:chart_of_accounts(synteticky_ucet, analyticky_ucet, nazov),
        side,
        amount,
        description
      )
    `
    )
    .eq("company_id", companyId)
    .eq("status", "posted")
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .is("deleted_at", null)
    .order("date")
    .order("number")

  if (entries && entries.length > 0) {
    const journalRows: any[][] = []
    for (const entry of entries) {
      for (const line of entry.lines || []) {
        const acct = line.account
        const accountCode = acct
          ? `${acct.synteticky_ucet}${acct.analyticky_ucet ? "." + acct.analyticky_ucet : ""}`
          : ""
        journalRows.push([
          entry.number,
          entry.date,
          entry.document_type,
          entry.description || "",
          accountCode,
          acct?.nazov || "",
          line.side,
          Number(line.amount).toFixed(2),
          line.description || "",
        ])
      }
    }
    sections.push({
      key: "journal_entries",
      title: "Uctovne zapisy (dennik)",
      headers: [
        "Cislo dokladu",
        "Datum",
        "Typ dokladu",
        "Popis",
        "Ucet",
        "Nazov uctu",
        "Strana",
        "Suma",
        "Popis riadku",
      ],
      rows: journalRows,
    })
  }

  // 3. Trial Balance (Obratova predvaha)
  const { data: allAccounts } = await (supabase
    .from("chart_of_accounts") as any)
    .select("id, synteticky_ucet, analyticky_ucet, nazov, typ")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("synteticky_ucet")

  if (allAccounts && allAccounts.length > 0) {
    const accountIds = allAccounts.map((a: any) => a.id)

    const { data: periodLines } = await (supabase
      .from("journal_entry_lines") as any)
      .select(
        `
        account_id,
        debit_amount,
        credit_amount,
        journal_entry:journal_entries!inner(id, company_id, status, date)
      `
      )
      .eq("journal_entry.company_id", companyId)
      .eq("journal_entry.status", "posted")
      .gte("journal_entry.date", dateFrom)
      .lte("journal_entry.date", dateTo)
      .in("account_id", accountIds)

    const movementMap: Record<string, { md: number; d: number }> = {}
    for (const line of periodLines || []) {
      if (!movementMap[line.account_id]) {
        movementMap[line.account_id] = { md: 0, d: 0 }
      }
      movementMap[line.account_id].md += Number(line.debit_amount) || 0
      movementMap[line.account_id].d += Number(line.credit_amount) || 0
    }

    const tbRows: any[][] = []
    for (const acct of allAccounts) {
      const m = movementMap[acct.id]
      if (!m) continue
      const accountCode = `${acct.synteticky_ucet}${acct.analyticky_ucet ? "." + acct.analyticky_ucet : ""}`
      tbRows.push([
        accountCode,
        acct.nazov,
        acct.typ,
        m.md.toFixed(2),
        m.d.toFixed(2),
        (m.md - m.d).toFixed(2),
      ])
    }

    if (tbRows.length > 0) {
      sections.push({
        key: "trial_balance",
        title: "Obratova predvaha",
        headers: [
          "Ucet",
          "Nazov",
          "Typ",
          "Obraty MD",
          "Obraty D",
          "Zostatok",
        ],
        rows: tbRows,
      })
    }
  }

  // 4. Balance Sheet (Suvaha)
  // Simplified: aggregate asset vs liability/equity accounts
  if (allAccounts && allAccounts.length > 0) {
    const accountIds = allAccounts.map((a: any) => a.id)
    const { data: bsLines } = await (supabase
      .from("journal_entry_lines") as any)
      .select(
        `
        account_id,
        debit_amount,
        credit_amount,
        journal_entry:journal_entries!inner(id, company_id, status, date)
      `
      )
      .eq("journal_entry.company_id", companyId)
      .eq("journal_entry.status", "posted")
      .lte("journal_entry.date", dateTo)
      .in("account_id", accountIds)

    const bsMap: Record<string, { md: number; d: number }> = {}
    for (const line of bsLines || []) {
      if (!bsMap[line.account_id]) {
        bsMap[line.account_id] = { md: 0, d: 0 }
      }
      bsMap[line.account_id].md += Number(line.debit_amount) || 0
      bsMap[line.account_id].d += Number(line.credit_amount) || 0
    }

    const bsAccounts = allAccounts.filter((a: any) => {
      const code = String(a.synteticky_ucet)
      const cls = parseInt(code.charAt(0))
      return cls >= 0 && cls <= 4
    })

    const bsRows: any[][] = []
    for (const acct of bsAccounts) {
      const m = bsMap[acct.id]
      if (!m) continue
      const balance = m.md - m.d
      if (Math.abs(balance) < 0.005) continue
      const accountCode = `${acct.synteticky_ucet}${acct.analyticky_ucet ? "." + acct.analyticky_ucet : ""}`
      bsRows.push([accountCode, acct.nazov, acct.typ, balance.toFixed(2)])
    }

    if (bsRows.length > 0) {
      sections.push({
        key: "balance_sheet",
        title: "Suvaha",
        headers: ["Ucet", "Nazov", "Typ", "Zostatok"],
        rows: bsRows,
      })
    }
  }

  // 5. P&L (Vykaz ziskov a strat)
  if (allAccounts && allAccounts.length > 0) {
    const plAccounts = allAccounts.filter((a: any) => {
      const code = String(a.synteticky_ucet)
      const cls = parseInt(code.charAt(0))
      return cls >= 5 && cls <= 6
    })
    const plIds = plAccounts.map((a: any) => a.id)

    if (plIds.length > 0) {
      const { data: plLines } = await (supabase
        .from("journal_entry_lines") as any)
        .select(
          `
          account_id,
          debit_amount,
          credit_amount,
          journal_entry:journal_entries!inner(id, company_id, status, date)
        `
        )
        .eq("journal_entry.company_id", companyId)
        .eq("journal_entry.status", "posted")
        .gte("journal_entry.date", dateFrom)
        .lte("journal_entry.date", dateTo)
        .in("account_id", plIds)

      const plMap: Record<string, { md: number; d: number }> = {}
      for (const line of plLines || []) {
        if (!plMap[line.account_id]) {
          plMap[line.account_id] = { md: 0, d: 0 }
        }
        plMap[line.account_id].md += Number(line.debit_amount) || 0
        plMap[line.account_id].d += Number(line.credit_amount) || 0
      }

      const plRows: any[][] = []
      for (const acct of plAccounts) {
        const m = plMap[acct.id]
        if (!m) continue
        const accountCode = `${acct.synteticky_ucet}${acct.analyticky_ucet ? "." + acct.analyticky_ucet : ""}`
        plRows.push([
          accountCode,
          acct.nazov,
          m.md.toFixed(2),
          m.d.toFixed(2),
          (m.d - m.md).toFixed(2),
        ])
      }

      if (plRows.length > 0) {
        sections.push({
          key: "profit_loss",
          title: "Vykaz ziskov a strat",
          headers: ["Ucet", "Nazov", "Naklady (MD)", "Vynosy (D)", "Zostatok"],
          rows: plRows,
        })
      }
    }
  }

  // 6. Issued Invoices (Vydane faktury)
  const { data: issuedInvoices } = await (supabase
    .from("invoices") as any)
    .select(
      "number, issue_date, due_date, type, status, total_amount, total_with_vat, currency, variable_symbol, contact:contacts(name)"
    )
    .eq("company_id", companyId)
    .eq("type", "vydana")
    .gte("issue_date", dateFrom)
    .lte("issue_date", dateTo)
    .is("deleted_at", null)
    .order("issue_date")

  if (issuedInvoices && issuedInvoices.length > 0) {
    sections.push({
      key: "issued_invoices",
      title: "Vydane faktury",
      headers: [
        "Cislo",
        "Datum vystavenia",
        "Splatnost",
        "Stav",
        "Odberatel",
        "Zaklad",
        "Celkom s DPH",
        "Mena",
        "VS",
      ],
      rows: issuedInvoices.map((inv: any) => [
        inv.number,
        inv.issue_date,
        inv.due_date,
        inv.status,
        inv.contact?.name || "",
        Number(inv.total_amount).toFixed(2),
        Number(inv.total_with_vat).toFixed(2),
        inv.currency || "EUR",
        inv.variable_symbol || "",
      ]),
    })
  }

  // 7. Received Invoices (Prijate faktury)
  const { data: receivedInvoices } = await (supabase
    .from("invoices") as any)
    .select(
      "number, issue_date, due_date, type, status, total_amount, total_with_vat, currency, variable_symbol, contact:contacts(name)"
    )
    .eq("company_id", companyId)
    .eq("type", "prijata")
    .gte("issue_date", dateFrom)
    .lte("issue_date", dateTo)
    .is("deleted_at", null)
    .order("issue_date")

  if (receivedInvoices && receivedInvoices.length > 0) {
    sections.push({
      key: "received_invoices",
      title: "Prijate faktury",
      headers: [
        "Cislo",
        "Datum vystavenia",
        "Splatnost",
        "Stav",
        "Dodavatel",
        "Zaklad",
        "Celkom s DPH",
        "Mena",
        "VS",
      ],
      rows: receivedInvoices.map((inv: any) => [
        inv.number,
        inv.issue_date,
        inv.due_date,
        inv.status,
        inv.contact?.name || "",
        Number(inv.total_amount).toFixed(2),
        Number(inv.total_with_vat).toFixed(2),
        inv.currency || "EUR",
        inv.variable_symbol || "",
      ]),
    })
  }

  // 8. Bank Statements (Bankove vypisy)
  const { data: bankTransactions } = await (supabase
    .from("bank_transactions") as any)
    .select(
      "id, date, amount, currency, type, description, counterparty_name, counterparty_iban, variable_symbol, reference"
    )
    .eq("company_id", companyId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date")

  if (bankTransactions && bankTransactions.length > 0) {
    sections.push({
      key: "bank_statements",
      title: "Bankove vypisy",
      headers: [
        "Datum",
        "Typ",
        "Suma",
        "Mena",
        "Protiucet",
        "IBAN",
        "VS",
        "Popis",
      ],
      rows: bankTransactions.map((t: any) => [
        t.date,
        t.type || "",
        Number(t.amount).toFixed(2),
        t.currency || "EUR",
        t.counterparty_name || "",
        t.counterparty_iban || "",
        t.variable_symbol || "",
        t.description || "",
      ]),
    })
  }

  // 9. Cash Register Book (Pokladnicna kniha)
  const { data: cashRegister } = await (supabase
    .from("cash_register_entries") as any)
    .select(
      "number, date, type, amount, currency, description, counterparty_name"
    )
    .eq("company_id", companyId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date")

  if (cashRegister && cashRegister.length > 0) {
    sections.push({
      key: "cash_register",
      title: "Pokladnicna kniha",
      headers: ["Cislo", "Datum", "Typ", "Suma", "Mena", "Popis", "Partner"],
      rows: cashRegister.map((c: any) => [
        c.number || "",
        c.date,
        c.type,
        Number(c.amount).toFixed(2),
        c.currency || "EUR",
        c.description || "",
        c.counterparty_name || "",
      ]),
    })
  }

  // 10. Asset Register (Register majetku)
  const { data: assets } = await (supabase.from("assets") as any)
    .select(
      "name, inventory_number, acquisition_date, acquisition_cost, current_value, depreciation_method, useful_life_years, category:asset_categories(name)"
    )
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("acquisition_date")

  if (assets && assets.length > 0) {
    sections.push({
      key: "asset_register",
      title: "Register majetku",
      headers: [
        "Nazov",
        "Inventarne cislo",
        "Datum zaradenia",
        "Obstarávacia cena",
        "Zostatková hodnota",
        "Metoda odpisovania",
        "Doba pouzitia (roky)",
        "Kategoria",
      ],
      rows: assets.map((a: any) => [
        a.name,
        a.inventory_number || "",
        a.acquisition_date,
        Number(a.acquisition_cost).toFixed(2),
        Number(a.current_value).toFixed(2),
        a.depreciation_method || "",
        a.useful_life_years || "",
        a.category?.name || "",
      ]),
    })
  }

  // 11. Payroll Summary (Mzdovy suhrn)
  const { data: payrolls } = await (supabase.from("payrolls") as any)
    .select(
      `
      id,
      month,
      year,
      employee:employees(first_name, last_name, personal_number),
      gross_salary,
      net_salary,
      employer_contributions,
      employee_contributions,
      income_tax
    `
    )
    .eq("company_id", companyId)
    .gte("year", parseInt(dateFrom.substring(0, 4)))
    .lte("year", parseInt(dateTo.substring(0, 4)))
    .order("year")
    .order("month")

  if (payrolls && payrolls.length > 0) {
    sections.push({
      key: "payroll_summary",
      title: "Mzdovy suhrn",
      headers: [
        "Zamestnanec",
        "Osobne cislo",
        "Mesiac",
        "Rok",
        "Hruba mzda",
        "Cista mzda",
        "Odvody zamestnavatel",
        "Odvody zamestnanec",
        "Dan z prijmov",
      ],
      rows: payrolls.map((p: any) => [
        p.employee
          ? `${p.employee.first_name} ${p.employee.last_name}`
          : "",
        p.employee?.personal_number || "",
        p.month,
        p.year,
        Number(p.gross_salary).toFixed(2),
        Number(p.net_salary).toFixed(2),
        Number(p.employer_contributions).toFixed(2),
        Number(p.employee_contributions).toFixed(2),
        Number(p.income_tax).toFixed(2),
      ]),
    })
  }

  return {
    companyName,
    fiscalYear: fyName,
    generatedAt: new Date().toISOString(),
    sections,
  }
}

// ---------------------------------------------------------------------------
// Statistical Reports - Quarterly (Stvrtrocny vykaz pre SU SR)
// ---------------------------------------------------------------------------

export async function generateQuarterlyReport(
  companyId: string,
  year: number,
  quarter: number,
  supabase: any
): Promise<QuarterlyStatReport> {
  // Company info
  const { data: company } = await (supabase.from("companies") as any)
    .select("id, name, ico")
    .eq("id", companyId)
    .single() as { data: any; error: any }

  // Quarter date range
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = quarter * 3
  const dateFrom = `${year}-${String(startMonth).padStart(2, "0")}-01`
  const lastDay =
    endMonth === 3 || endMonth === 12
      ? 31
      : endMonth === 6 || endMonth === 9
        ? 30
        : 31
  const dateTo = `${year}-${String(endMonth).padStart(2, "0")}-${lastDay}`

  // Fetch all accounts
  const { data: allAccounts } = await (supabase
    .from("chart_of_accounts") as any)
    .select("id, synteticky_ucet, nazov, typ")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  const accountIds = (allAccounts || []).map((a: any) => a.id)
  const accountMap: Record<string, any> = {}
  for (const a of allAccounts || []) {
    accountMap[a.id] = a
  }

  // Fetch period lines
  let periodLines: any[] = []
  if (accountIds.length > 0) {
    const { data } = await (supabase.from("journal_entry_lines") as any)
      .select(
        `
        account_id,
        debit_amount,
        credit_amount,
        journal_entry:journal_entries!inner(id, company_id, status, date)
      `
      )
      .eq("journal_entry.company_id", companyId)
      .eq("journal_entry.status", "posted")
      .gte("journal_entry.date", dateFrom)
      .lte("journal_entry.date", dateTo)
      .in("account_id", accountIds)

    periodLines = data || []
  }

  // Aggregate by account
  const accountTotals: Record<string, { md: number; d: number }> = {}
  for (const line of periodLines) {
    if (!accountTotals[line.account_id]) {
      accountTotals[line.account_id] = { md: 0, d: 0 }
    }
    accountTotals[line.account_id].md += Number(line.debit_amount) || 0
    accountTotals[line.account_id].d += Number(line.credit_amount) || 0
  }

  // Helper: sum accounts starting with prefix (revenue = credit side, expense = debit side)
  const sumAccounts = (
    prefixes: string[],
    side: "md" | "d"
  ): number => {
    let total = 0
    for (const accountId of Object.keys(accountTotals)) {
      const acct = accountMap[accountId]
      if (!acct) continue
      const code = String(acct.synteticky_ucet)
      for (const prefix of prefixes) {
        if (code.startsWith(prefix)) {
          total += accountTotals[accountId][side]
          break
        }
      }
    }
    return total
  }

  // Revenue accounts: 60x = Trzby za vl. vykony, 604 = Trzby za tovar
  const trzby_vlastne_vykony = sumAccounts(["601", "602", "606"], "d")
  const trzby_tovar = sumAccounts(["604"], "d")
  const trzby_spolu = trzby_vlastne_vykony + trzby_tovar

  // Expense accounts: 5xx
  const naklady_hospodarsku_cinnost = sumAccounts(
    ["50", "51", "52", "53", "54", "55"],
    "md"
  )

  const vysledok_hospodarenia = trzby_spolu - naklady_hospodarsku_cinnost

  // Wages: 521 = Mzdove naklady
  const mzdove_naklady = sumAccounts(["521"], "md")

  // Depreciation: 551
  const odpisy = sumAccounts(["551"], "md")

  // Investments: from assets acquired in the period
  const { data: newAssets } = await (supabase.from("assets") as any)
    .select("acquisition_cost")
    .eq("company_id", companyId)
    .gte("acquisition_date", dateFrom)
    .lte("acquisition_date", dateTo)
    .is("deleted_at", null)

  let investicie = 0
  for (const asset of newAssets || []) {
    investicie += Number(asset.acquisition_cost) || 0
  }

  // Employees: count distinct active employees
  const { data: employees } = await (supabase.from("employees") as any)
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "active")
    .is("deleted_at", null)

  const priemerny_pocet_zamestnancov = employees?.length || 0

  return {
    company: company?.name || "",
    ico: company?.ico || "",
    year,
    quarter,
    generatedAt: new Date().toISOString(),
    trzby_vlastne_vykony,
    trzby_tovar,
    trzby_spolu,
    naklady_hospodarsku_cinnost,
    vysledok_hospodarenia,
    priemerny_pocet_zamestnancov,
    mzdove_naklady,
    investicie,
    odpisy,
  }
}

// ---------------------------------------------------------------------------
// Statistical Reports - Annual (Rocny vykaz Uc POD)
// ---------------------------------------------------------------------------

export async function generateAnnualReport(
  companyId: string,
  fiscalYearId: string,
  supabase: any
): Promise<AnnualStatReport> {
  // Company info
  const { data: company } = await (supabase.from("companies") as any)
    .select("id, name, ico")
    .eq("id", companyId)
    .single() as { data: any; error: any }

  // Fiscal year
  const { data: fy } = await (supabase.from("fiscal_years") as any)
    .select("id, name, start_date, end_date")
    .eq("id", fiscalYearId)
    .single() as { data: any; error: any }

  const dateFrom = fy?.start_date || "2024-01-01"
  const dateTo = fy?.end_date || "2024-12-31"
  const fyName = fy?.name || `${dateFrom} - ${dateTo}`

  // Fetch all accounts
  const { data: allAccounts } = await (supabase
    .from("chart_of_accounts") as any)
    .select("id, synteticky_ucet, nazov, typ")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  const accountIds = (allAccounts || []).map((a: any) => a.id)
  const accountMap: Record<string, any> = {}
  for (const a of allAccounts || []) {
    accountMap[a.id] = a
  }

  // Fetch all posted lines up to dateTo (for balance sheet)
  let bsLines: any[] = []
  if (accountIds.length > 0) {
    const { data } = await (supabase.from("journal_entry_lines") as any)
      .select(
        `
        account_id,
        debit_amount,
        credit_amount,
        journal_entry:journal_entries!inner(id, company_id, status, date)
      `
      )
      .eq("journal_entry.company_id", companyId)
      .eq("journal_entry.status", "posted")
      .lte("journal_entry.date", dateTo)
      .in("account_id", accountIds)

    bsLines = data || []
  }

  // Fetch period lines (for P&L)
  let plLines: any[] = []
  if (accountIds.length > 0) {
    const { data } = await (supabase.from("journal_entry_lines") as any)
      .select(
        `
        account_id,
        debit_amount,
        credit_amount,
        journal_entry:journal_entries!inner(id, company_id, status, date)
      `
      )
      .eq("journal_entry.company_id", companyId)
      .eq("journal_entry.status", "posted")
      .gte("journal_entry.date", dateFrom)
      .lte("journal_entry.date", dateTo)
      .in("account_id", accountIds)

    plLines = data || []
  }

  // Build BS totals
  const bsTotals: Record<string, number> = {}
  for (const line of bsLines) {
    const acct = accountMap[line.account_id]
    if (!acct) continue
    if (!bsTotals[line.account_id]) bsTotals[line.account_id] = 0
    bsTotals[line.account_id] +=
      (Number(line.debit_amount) || 0) - (Number(line.credit_amount) || 0)
  }

  // Build PL totals
  const plTotals: Record<string, { md: number; d: number }> = {}
  for (const line of plLines) {
    if (!plTotals[line.account_id]) {
      plTotals[line.account_id] = { md: 0, d: 0 }
    }
    plTotals[line.account_id].md += Number(line.debit_amount) || 0
    plTotals[line.account_id].d += Number(line.credit_amount) || 0
  }

  // Helper for BS: sum balances of accounts with given prefixes
  const sumBS = (prefixes: string[]): number => {
    let total = 0
    for (const accountId of Object.keys(bsTotals)) {
      const acct = accountMap[accountId]
      if (!acct) continue
      const code = String(acct.synteticky_ucet)
      for (const prefix of prefixes) {
        if (code.startsWith(prefix)) {
          total += bsTotals[accountId]
          break
        }
      }
    }
    return total
  }

  // Helper for PL: sum specific side of accounts
  const sumPL = (prefixes: string[], side: "md" | "d"): number => {
    let total = 0
    for (const accountId of Object.keys(plTotals)) {
      const acct = accountMap[accountId]
      if (!acct) continue
      const code = String(acct.synteticky_ucet)
      for (const prefix of prefixes) {
        if (code.startsWith(prefix)) {
          total += plTotals[accountId][side]
          break
        }
      }
    }
    return total
  }

  // Balance Sheet
  const neobezny_majetok = sumBS(["01", "02", "03", "04", "05", "06", "07", "08", "09"])
  const obezny_majetok = sumBS(["1", "2", "3"])
  const casove_rozlisenie_aktiv = sumBS(["381", "382", "385"])
  const aktiva_spolu = neobezny_majetok + obezny_majetok + casove_rozlisenie_aktiv

  const vlastne_imanie = -sumBS(["41", "42", "43"])
  const zavazky = -sumBS(["3", "4"])
  const casove_rozlisenie_pasiv = -sumBS(["383", "384"])
  const pasiva_spolu = vlastne_imanie + zavazky + casove_rozlisenie_pasiv

  // P&L
  const trzby_predaj_tovaru = sumPL(["604"], "d")
  const naklady_obstaranie_tovaru = sumPL(["504"], "md")
  const obchodna_marza = trzby_predaj_tovaru - naklady_obstaranie_tovaru

  const vyroby = sumPL(["601", "602", "606", "61", "62"], "d")
  const vyrobna_spotreba = sumPL(["50", "51"], "md")
  const pridana_hodnota = obchodna_marza + vyroby - vyrobna_spotreba

  const osobne_naklady = sumPL(["52"], "md")
  const odpisy = sumPL(["551"], "md")

  const prevadzkove_vynosy = sumPL(["60", "61", "62", "64", "65"], "d")
  const prevadzkove_naklady = sumPL(["50", "51", "52", "53", "54", "55"], "md")
  const prevadzkovy_vysledok = prevadzkove_vynosy - prevadzkove_naklady

  const financne_vynosy = sumPL(["66"], "d")
  const financne_naklady = sumPL(["56"], "md")
  const financny_vysledok = financne_vynosy - financne_naklady

  const vysledok_pred_zdanenim = prevadzkovy_vysledok + financny_vysledok
  const dan_z_prijmov = sumPL(["59"], "md")
  const vysledok_po_zdaneni = vysledok_pred_zdanenim - dan_z_prijmov

  // Employees
  const { data: employees } = await (supabase.from("employees") as any)
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "active")
    .is("deleted_at", null)

  const priemerny_pocet = employees?.length || 0

  // Revenue by industry (we group by first 2 digits of revenue accounts)
  const trzbyOdvetvie: Record<string, number> = {}
  for (const accountId of Object.keys(plTotals)) {
    const acct = accountMap[accountId]
    if (!acct) continue
    const code = String(acct.synteticky_ucet)
    if (code.startsWith("6")) {
      const label = acct.nazov || code
      trzbyOdvetvie[label] = (trzbyOdvetvie[label] || 0) + plTotals[accountId].d
    }
  }

  const trzby_podla_odvetvia = Array.from(Object.entries(trzbyOdvetvie))
    .map(([odvetvie, suma]) => ({ odvetvie, suma }))
    .filter((t) => t.suma > 0)
    .sort((a, b) => b.suma - a.suma)

  return {
    company: company?.name || "",
    ico: company?.ico || "",
    fiscalYear: fyName,
    generatedAt: new Date().toISOString(),
    balanceSheet: {
      aktiva_spolu,
      neobezny_majetok,
      obezny_majetok,
      casove_rozlisenie_aktiv,
      pasiva_spolu,
      vlastne_imanie,
      zavazky,
      casove_rozlisenie_pasiv,
    },
    profitLoss: {
      trzby_predaj_tovaru,
      naklady_obstaranie_tovaru,
      obchodna_marza,
      vyroby,
      vyrobna_spotreba,
      pridana_hodnota,
      osobne_naklady,
      odpisy,
      prevadzkovy_vysledok,
      financny_vysledok,
      vysledok_pred_zdanenim,
      dan_z_prijmov,
      vysledok_po_zdaneni,
    },
    statistics: {
      priemerny_pocet_zamestnancov: priemerny_pocet,
      osobne_naklady,
      odpisy,
      trzby_podla_odvetvia,
    },
  }
}

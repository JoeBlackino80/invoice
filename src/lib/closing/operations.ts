import type { SupabaseClient } from "@supabase/supabase-js"

interface ClosingResult {
  success: boolean
  journalEntryId?: string
  error?: string
  totalAmount?: number
  accountsCount?: number
}

interface AccountBalance {
  accountId: string
  synteticky: string
  analyticky: string | null
  nazov: string
  totalMD: number
  totalD: number
  balance: number
}

async function getAccountBalances(
  companyId: string,
  fiscalYearStart: string,
  fiscalYearEnd: string,
  accountClassPrefix: string,
  supabase: SupabaseClient
): Promise<AccountBalance[]> {
  // Get all accounts of the specified class
  const { data: accounts, error: accountsError } = await (supabase.from("chart_of_accounts") as any)
    .select("id, synteticky_ucet, analyticky_ucet, nazov")
    .eq("company_id", companyId)
    .like("synteticky_ucet", `${accountClassPrefix}%`)
    .is("deleted_at", null)

  if (accountsError || !accounts || accounts.length === 0) {
    return []
  }

  const accountIds = accounts.map((a: any) => a.id)

  // Get posted journal entry lines for these accounts in the fiscal year
  const { data: lines, error: linesError } = await (supabase.from("journal_entry_lines") as any)
    .select(`
      account_id,
      side,
      amount,
      journal_entry:journal_entries!inner(id, company_id, status, date)
    `)
    .eq("journal_entry.company_id", companyId)
    .eq("journal_entry.status", "posted")
    .gte("journal_entry.date", fiscalYearStart)
    .lte("journal_entry.date", fiscalYearEnd)
    .in("account_id", accountIds)

  if (linesError) {
    return []
  }

  // Aggregate balances per account
  const balanceMap: Record<string, { totalMD: number; totalD: number }> = {}
  for (const line of (lines || [])) {
    if (!balanceMap[line.account_id]) {
      balanceMap[line.account_id] = { totalMD: 0, totalD: 0 }
    }
    const amount = Number(line.amount) || 0
    if (line.side === "MD") {
      balanceMap[line.account_id].totalMD += amount
    } else {
      balanceMap[line.account_id].totalD += amount
    }
  }

  const result: AccountBalance[] = []
  for (const account of accounts) {
    const bal = balanceMap[account.id]
    if (!bal) continue
    if (bal.totalMD === 0 && bal.totalD === 0) continue

    result.push({
      accountId: account.id,
      synteticky: account.synteticky_ucet,
      analyticky: account.analyticky_ucet,
      nazov: account.nazov,
      totalMD: bal.totalMD,
      totalD: bal.totalD,
      balance: bal.totalMD - bal.totalD,
    })
  }

  return result
}

async function findOrCreateAccount(
  companyId: string,
  synteticky: string,
  nazov: string,
  typ: string,
  supabase: SupabaseClient
): Promise<string | null> {
  // Try to find existing account
  const { data: existing } = await (supabase.from("chart_of_accounts") as any)
    .select("id")
    .eq("company_id", companyId)
    .eq("synteticky_ucet", synteticky)
    .is("deleted_at", null)
    .limit(1)

  if (existing && existing.length > 0) {
    return existing[0].id
  }

  // Create the account
  const { data: created, error } = await (supabase.from("chart_of_accounts") as any)
    .insert({
      company_id: companyId,
      synteticky_ucet: synteticky,
      nazov,
      typ,
      aktivny: true,
    })
    .select("id")
    .single() as { data: any; error: any }

  if (error) return null
  return created.id
}

async function createClosingJournalEntry(
  companyId: string,
  userId: string,
  date: string,
  description: string,
  lines: Array<{ account_id: string; side: "MD" | "D"; amount: number; description?: string }>,
  supabase: SupabaseClient
): Promise<{ id: string } | null> {
  if (lines.length === 0) return null

  // Generate document number
  const { data: documentNumber, error: numberError } = await (supabase
    .rpc as any)("generate_next_number", {
    p_company_id: companyId,
    p_type: "uctovny_zapis_ID",
  })

  const number = numberError ? `UZ-${Date.now()}` : documentNumber

  const totalMD = lines.filter((l) => l.side === "MD").reduce((sum, l) => sum + l.amount, 0)
  const totalD = lines.filter((l) => l.side === "D").reduce((sum, l) => sum + l.amount, 0)

  // Insert journal entry header
  const { data: entry, error: entryError } = await (supabase
    .from("journal_entries") as any)
    .insert({
      company_id: companyId,
      number,
      document_type: "ID",
      date,
      description,
      status: "posted",
      posted_at: new Date().toISOString(),
      posted_by: userId,
      total_md: totalMD,
      total_d: totalD,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single() as { data: any; error: any }

  if (entryError) return null

  // Insert lines
  const linesToInsert = lines.map((line, index) => ({
    company_id: companyId,
    journal_entry_id: entry.id,
    position: index,
    account_id: line.account_id,
    side: line.side,
    amount: Math.round(line.amount * 100) / 100,
    currency: "EUR",
    description: line.description || null,
  }))

  const { error: linesError } = await (supabase
    .from("journal_entry_lines") as any)
    .insert(linesToInsert)

  if (linesError) {
    // Rollback: delete the entry
    await (supabase.from("journal_entries") as any).delete().eq("id", entry.id)
    return null
  }

  return { id: entry.id }
}

/**
 * Close all class 6 (revenue) accounts to account 710 - Ucet ziskov a strat
 * Per Slovak standards: Debit revenue accounts, Credit 710
 */
export async function closeRevenueAccounts(
  companyId: string,
  fiscalYearId: string,
  fiscalYearStart: string,
  fiscalYearEnd: string,
  userId: string,
  supabase: SupabaseClient
): Promise<ClosingResult> {
  try {
    // Get revenue account balances (class 6)
    const balances = await getAccountBalances(companyId, fiscalYearStart, fiscalYearEnd, "6", supabase)

    if (balances.length === 0) {
      return { success: true, accountsCount: 0, totalAmount: 0 }
    }

    // Ensure account 710 exists
    const account710Id = await findOrCreateAccount(
      companyId, "710", "Ucet ziskov a strat", "pasivny", supabase
    )
    if (!account710Id) {
      return { success: false, error: "Nepodarilo sa najst alebo vytvorit ucet 710" }
    }

    const lines: Array<{ account_id: string; side: "MD" | "D"; amount: number; description?: string }> = []
    let totalRevenue = 0

    for (const bal of balances) {
      // Revenue accounts typically have credit balances (D > MD)
      // To close: Debit the revenue account, Credit 710
      const creditBalance = bal.totalD - bal.totalMD
      if (Math.abs(creditBalance) < 0.01) continue

      if (creditBalance > 0) {
        // Normal: revenue has credit balance -> debit to close
        lines.push({
          account_id: bal.accountId,
          side: "MD",
          amount: Math.round(creditBalance * 100) / 100,
          description: `Uzavretie vynosoveho uctu ${bal.synteticky} - ${bal.nazov}`,
        })
        totalRevenue += creditBalance
      } else {
        // Abnormal: revenue has debit balance -> credit to close
        lines.push({
          account_id: bal.accountId,
          side: "D",
          amount: Math.round(Math.abs(creditBalance) * 100) / 100,
          description: `Uzavretie vynosoveho uctu ${bal.synteticky} - ${bal.nazov}`,
        })
        totalRevenue += creditBalance // negative
      }
    }

    if (lines.length === 0) {
      return { success: true, accountsCount: 0, totalAmount: 0 }
    }

    // Counterpart entry to 710
    if (totalRevenue > 0) {
      lines.push({
        account_id: account710Id,
        side: "D",
        amount: Math.round(totalRevenue * 100) / 100,
        description: "Prevod vynosov na ucet 710 - Ucet ziskov a strat",
      })
    } else if (totalRevenue < 0) {
      lines.push({
        account_id: account710Id,
        side: "MD",
        amount: Math.round(Math.abs(totalRevenue) * 100) / 100,
        description: "Prevod vynosov na ucet 710 - Ucet ziskov a strat",
      })
    }

    const closingDate = fiscalYearEnd
    const result = await createClosingJournalEntry(
      companyId,
      userId,
      closingDate,
      `Uzavretie vynosovych uctov triedy 6 za obdobie ${fiscalYearStart} - ${fiscalYearEnd}`,
      lines,
      supabase
    )

    if (!result) {
      return { success: false, error: "Nepodarilo sa vytvorit uzavierkovy uctovny zapis" }
    }

    return {
      success: true,
      journalEntryId: result.id,
      totalAmount: Math.round(Math.abs(totalRevenue) * 100) / 100,
      accountsCount: balances.length,
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Neocakavana chyba" }
  }
}

/**
 * Close all class 5 (expense) accounts to account 710 - Ucet ziskov a strat
 * Per Slovak standards: Credit expense accounts, Debit 710
 */
export async function closeExpenseAccounts(
  companyId: string,
  fiscalYearId: string,
  fiscalYearStart: string,
  fiscalYearEnd: string,
  userId: string,
  supabase: SupabaseClient
): Promise<ClosingResult> {
  try {
    // Get expense account balances (class 5)
    const balances = await getAccountBalances(companyId, fiscalYearStart, fiscalYearEnd, "5", supabase)

    if (balances.length === 0) {
      return { success: true, accountsCount: 0, totalAmount: 0 }
    }

    // Ensure account 710 exists
    const account710Id = await findOrCreateAccount(
      companyId, "710", "Ucet ziskov a strat", "pasivny", supabase
    )
    if (!account710Id) {
      return { success: false, error: "Nepodarilo sa najst alebo vytvorit ucet 710" }
    }

    const lines: Array<{ account_id: string; side: "MD" | "D"; amount: number; description?: string }> = []
    let totalExpense = 0

    for (const bal of balances) {
      // Expense accounts typically have debit balances (MD > D)
      // To close: Credit the expense account, Debit 710
      const debitBalance = bal.totalMD - bal.totalD
      if (Math.abs(debitBalance) < 0.01) continue

      if (debitBalance > 0) {
        // Normal: expense has debit balance -> credit to close
        lines.push({
          account_id: bal.accountId,
          side: "D",
          amount: Math.round(debitBalance * 100) / 100,
          description: `Uzavretie nakladoveho uctu ${bal.synteticky} - ${bal.nazov}`,
        })
        totalExpense += debitBalance
      } else {
        // Abnormal: expense has credit balance -> debit to close
        lines.push({
          account_id: bal.accountId,
          side: "MD",
          amount: Math.round(Math.abs(debitBalance) * 100) / 100,
          description: `Uzavretie nakladoveho uctu ${bal.synteticky} - ${bal.nazov}`,
        })
        totalExpense += debitBalance // negative
      }
    }

    if (lines.length === 0) {
      return { success: true, accountsCount: 0, totalAmount: 0 }
    }

    // Counterpart entry to 710
    if (totalExpense > 0) {
      lines.push({
        account_id: account710Id,
        side: "MD",
        amount: Math.round(totalExpense * 100) / 100,
        description: "Prevod nakladov na ucet 710 - Ucet ziskov a strat",
      })
    } else if (totalExpense < 0) {
      lines.push({
        account_id: account710Id,
        side: "D",
        amount: Math.round(Math.abs(totalExpense) * 100) / 100,
        description: "Prevod nakladov na ucet 710 - Ucet ziskov a strat",
      })
    }

    const closingDate = fiscalYearEnd
    const result = await createClosingJournalEntry(
      companyId,
      userId,
      closingDate,
      `Uzavretie nakladovych uctov triedy 5 za obdobie ${fiscalYearStart} - ${fiscalYearEnd}`,
      lines,
      supabase
    )

    if (!result) {
      return { success: false, error: "Nepodarilo sa vytvorit uzavierkovy uctovny zapis" }
    }

    return {
      success: true,
      journalEntryId: result.id,
      totalAmount: Math.round(Math.abs(totalExpense) * 100) / 100,
      accountsCount: balances.length,
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Neocakavana chyba" }
  }
}

/**
 * Close P&L account 710 to either 702 (opening balance) with profit or loss
 * Profit: 710 MD -> 702 D
 * Loss: 702 MD -> 710 D
 */
export async function closeProfitLossAccount(
  companyId: string,
  fiscalYearId: string,
  fiscalYearStart: string,
  fiscalYearEnd: string,
  userId: string,
  supabase: SupabaseClient
): Promise<ClosingResult> {
  try {
    // Get account 710 balance
    const balances710 = await getAccountBalances(companyId, fiscalYearStart, fiscalYearEnd, "710", supabase)

    if (balances710.length === 0) {
      return { success: true, accountsCount: 0, totalAmount: 0 }
    }

    const bal710 = balances710[0]
    const plBalance = bal710.totalD - bal710.totalMD // Positive = profit, Negative = loss

    if (Math.abs(plBalance) < 0.01) {
      return { success: true, accountsCount: 0, totalAmount: 0 }
    }

    // Ensure account 710 exists
    const account710Id = await findOrCreateAccount(
      companyId, "710", "Ucet ziskov a strat", "pasivny", supabase
    )
    if (!account710Id) {
      return { success: false, error: "Nepodarilo sa najst alebo vytvorit ucet 710" }
    }

    const lines: Array<{ account_id: string; side: "MD" | "D"; amount: number; description?: string }> = []

    if (plBalance > 0) {
      // Profit: Close 710 to 702 (Konecny ucet suvahovy)
      const account702Id = await findOrCreateAccount(
        companyId, "702", "Konecny ucet suvahovy", "pasivny", supabase
      )
      if (!account702Id) {
        return { success: false, error: "Nepodarilo sa najst alebo vytvorit ucet 702" }
      }

      lines.push({
        account_id: account710Id,
        side: "MD",
        amount: Math.round(plBalance * 100) / 100,
        description: "Uzavretie uctu 710 - prevod zisku",
      })
      lines.push({
        account_id: account702Id,
        side: "D",
        amount: Math.round(plBalance * 100) / 100,
        description: "Prevod zisku z uctu 710 na ucet 702",
      })
    } else {
      // Loss: Close 710 to 702 (other direction)
      const account702Id = await findOrCreateAccount(
        companyId, "702", "Konecny ucet suvahovy", "pasivny", supabase
      )
      if (!account702Id) {
        return { success: false, error: "Nepodarilo sa najst alebo vytvorit ucet 702" }
      }

      const lossAmount = Math.abs(plBalance)
      lines.push({
        account_id: account710Id,
        side: "D",
        amount: Math.round(lossAmount * 100) / 100,
        description: "Uzavretie uctu 710 - prevod straty",
      })
      lines.push({
        account_id: account702Id,
        side: "MD",
        amount: Math.round(lossAmount * 100) / 100,
        description: "Prevod straty z uctu 710 na ucet 702",
      })
    }

    const closingDate = fiscalYearEnd
    const result = await createClosingJournalEntry(
      companyId,
      userId,
      closingDate,
      `Uzavretie vysledkoveho uctu 710 za obdobie ${fiscalYearStart} - ${fiscalYearEnd}`,
      lines,
      supabase
    )

    if (!result) {
      return { success: false, error: "Nepodarilo sa vytvorit uzavierkovy uctovny zapis" }
    }

    return {
      success: true,
      journalEntryId: result.id,
      totalAmount: Math.round(Math.abs(plBalance) * 100) / 100,
      accountsCount: 1,
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Neocakavana chyba" }
  }
}

/**
 * Generate opening balances for the next fiscal year from balance sheet accounts (classes 0-4)
 * Creates journal entries using account 701 (Zaciatocny ucet suvahovy)
 */
export async function generateOpeningBalances(
  companyId: string,
  fiscalYearId: string,
  fiscalYearStart: string,
  fiscalYearEnd: string,
  userId: string,
  supabase: SupabaseClient
): Promise<ClosingResult> {
  try {
    // Get balances for balance sheet accounts (classes 0-4)
    const allBalances: AccountBalance[] = []
    for (const cls of ["0", "1", "2", "3", "4"]) {
      const classBalances = await getAccountBalances(companyId, fiscalYearStart, fiscalYearEnd, cls, supabase)
      allBalances.push(...classBalances)
    }

    if (allBalances.length === 0) {
      return { success: true, accountsCount: 0, totalAmount: 0 }
    }

    // Ensure account 701 (Zaciatocny ucet suvahovy) exists
    const account701Id = await findOrCreateAccount(
      companyId, "701", "Zaciatocny ucet suvahovy", "pasivny", supabase
    )
    if (!account701Id) {
      return { success: false, error: "Nepodarilo sa najst alebo vytvorit ucet 701" }
    }

    // Calculate next fiscal year start date
    const nextYearStart = new Date(fiscalYearEnd)
    nextYearStart.setDate(nextYearStart.getDate() + 1)
    const openingDate = nextYearStart.toISOString().split("T")[0]

    const lines: Array<{ account_id: string; side: "MD" | "D"; amount: number; description?: string }> = []
    let total701MD = 0
    let total701D = 0

    for (const bal of allBalances) {
      const netBalance = bal.totalMD - bal.totalD
      if (Math.abs(netBalance) < 0.01) continue

      if (netBalance > 0) {
        // Active account with debit balance: MD account, D 701
        lines.push({
          account_id: bal.accountId,
          side: "MD",
          amount: Math.round(netBalance * 100) / 100,
          description: `Pociatocny zostatok uctu ${bal.synteticky} - ${bal.nazov}`,
        })
        total701D += netBalance
      } else {
        // Passive account with credit balance: MD 701, D account
        lines.push({
          account_id: bal.accountId,
          side: "D",
          amount: Math.round(Math.abs(netBalance) * 100) / 100,
          description: `Pociatocny zostatok uctu ${bal.synteticky} - ${bal.nazov}`,
        })
        total701MD += Math.abs(netBalance)
      }
    }

    if (lines.length === 0) {
      return { success: true, accountsCount: 0, totalAmount: 0 }
    }

    // Add 701 counterpart lines
    if (total701D > 0) {
      lines.push({
        account_id: account701Id,
        side: "D",
        amount: Math.round(total701D * 100) / 100,
        description: "Zaciatocny ucet suvahovy - aktivne zostatky",
      })
    }
    if (total701MD > 0) {
      lines.push({
        account_id: account701Id,
        side: "MD",
        amount: Math.round(total701MD * 100) / 100,
        description: "Zaciatocny ucet suvahovy - pasivne zostatky",
      })
    }

    const result = await createClosingJournalEntry(
      companyId,
      userId,
      openingDate,
      `Pociatocne stavy uctov - prevod z obdobia ${fiscalYearStart} - ${fiscalYearEnd}`,
      lines,
      supabase
    )

    if (!result) {
      return { success: false, error: "Nepodarilo sa vytvorit uctovny zapis s pociatocnymi stavmi" }
    }

    return {
      success: true,
      journalEntryId: result.id,
      totalAmount: Math.round((total701MD + total701D) * 100) / 100,
      accountsCount: allBalances.length,
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Neocakavana chyba" }
  }
}

"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  BookOpen,
  Printer,
  FileDown,
} from "lucide-react"

interface CashRegister {
  id: string
  name: string
  currency: string
  current_balance: number
}

interface BookEntry {
  id: string
  document_number: string
  date: string
  type: string
  purpose: string
  person: string | null
  income: number
  expense: number
  balance: number
}

interface BookData {
  register: {
    id: string
    name: string
    currency: string
    account_number: string
  }
  period: {
    date_from: string | null
    date_to: string | null
  }
  opening_balance: number
  closing_balance: number
  total_income: number
  total_expense: number
  entries: BookEntry[]
}

function formatMoney(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

function CashBookPageContent() {
  const searchParamsHook = useSearchParams()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [bookData, setBookData] = useState<BookData | null>(null)
  const [loading, setLoading] = useState(false)

  const [selectedRegister, setSelectedRegister] = useState(searchParamsHook.get("cash_register_id") || "")
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  })
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return lastDay.toISOString().split("T")[0]
  })

  // Fetch cash registers for dropdown
  const fetchRegisters = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/cash-registers?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok && json.data) {
        setRegisters(json.data)
        // Auto-select first if none selected and has registers
        if (!selectedRegister && json.data.length > 0) {
          setSelectedRegister(json.data[0].id)
        }
      }
    } catch {
      // silent
    }
  }, [activeCompanyId, selectedRegister])

  // Fetch cash book data
  const fetchBook = useCallback(async () => {
    if (!activeCompanyId || !selectedRegister) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        cash_register_id: selectedRegister,
      })
      if (dateFrom) params.set("date_from", dateFrom)
      if (dateTo) params.set("date_to", dateTo)

      const res = await fetch(`/api/cash-register/book?${params}`)
      const json = await res.json()

      if (res.ok) {
        setBookData(json)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa nacitat pokladnicnu knihu" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat pokladnicnu knihu" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedRegister, dateFrom, dateTo, toast])

  useEffect(() => {
    fetchRegisters()
  }, [fetchRegisters])

  useEffect(() => {
    if (selectedRegister) {
      fetchBook()
    }
  }, [fetchBook, selectedRegister])

  const handlePrint = () => {
    window.print()
  }

  const currency = bookData?.register?.currency || "EUR"

  return (
    <div>
      <div className="print:hidden">
        <Breadcrumb />
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pokladnicna kniha</h1>
          <p className="text-muted-foreground print:hidden">Chronologicky prehlad pokladnicnych dokladov</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Tlacit
          </Button>
        </div>
      </div>

      {/* Filters - hidden on print */}
      <div className="flex flex-wrap items-end gap-4 mb-6 print:hidden">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Pokladna</label>
          <select
            className="flex h-10 w-56 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={selectedRegister}
            onChange={(e) => setSelectedRegister(e.target.value)}
          >
            <option value="">Vyberte pokladnu</option>
            {registers.map((r) => (
              <option key={r.id} value={r.id}>{r.name} ({r.currency})</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Od</label>
          <Input
            type="date"
            className="w-40"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Do</label>
          <Input
            type="date"
            className="w-40"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <Button onClick={fetchBook} disabled={!selectedRegister}>
          Zobrazit
        </Button>
      </div>

      {/* Book header - for print */}
      {bookData && (
        <div className="hidden print:block mb-4 text-center">
          <h2 className="text-xl font-bold">Pokladnicna kniha</h2>
          <p className="text-sm">
            Pokladna: {bookData.register.name} | Ucet: {bookData.register.account_number} | Mena: {currency}
          </p>
          <p className="text-sm">
            Obdobie: {dateFrom ? formatDate(dateFrom) : "---"} - {dateTo ? formatDate(dateTo) : "---"}
          </p>
        </div>
      )}

      {!selectedRegister ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Vyberte pokladnu pre zobrazenie pokladnicnej knihy.</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nacitavam pokladnicnu knihu...
          </CardContent>
        </Card>
      ) : bookData ? (
        <Card>
          <CardHeader className="print:hidden">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {bookData.register.name} - Ucet {bookData.register.account_number}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium">C. dokladu</th>
                    <th className="h-10 px-4 text-left font-medium">Datum</th>
                    <th className="h-10 px-4 text-left font-medium">Ucel</th>
                    <th className="h-10 px-4 text-left font-medium">Osoba</th>
                    <th className="h-10 px-4 text-right font-medium">Prijem</th>
                    <th className="h-10 px-4 text-right font-medium">Vydaj</th>
                    <th className="h-10 px-4 text-right font-medium">Zostatok</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening balance row */}
                  <tr className="border-b bg-blue-50 dark:bg-blue-950/30 font-medium">
                    <td className="px-4 py-3" colSpan={4}>
                      Pociatocny zostatok
                    </td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right font-bold">
                      {formatMoney(bookData.opening_balance, currency)}
                    </td>
                  </tr>

                  {/* Transaction rows */}
                  {bookData.entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="h-16 text-center text-muted-foreground">
                        Ziadne transakcie v tomto obdobi.
                      </td>
                    </tr>
                  ) : (
                    bookData.entries.map((entry) => (
                      <tr key={entry.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{entry.document_number}</td>
                        <td className="px-4 py-3">{formatDate(entry.date)}</td>
                        <td className="px-4 py-3">{entry.purpose}</td>
                        <td className="px-4 py-3 text-muted-foreground">{entry.person || "-"}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">
                          {entry.income > 0 ? formatMoney(entry.income, currency) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600 font-medium">
                          {entry.expense > 0 ? formatMoney(entry.expense, currency) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatMoney(entry.balance, currency)}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Summary / closing balance row */}
                  <tr className="border-t-2 bg-muted/50 font-bold">
                    <td className="px-4 py-3" colSpan={4}>
                      Sucet za obdobie / Konecny zostatok
                    </td>
                    <td className="px-4 py-3 text-right text-green-600">
                      {formatMoney(bookData.total_income, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {formatMoney(bookData.total_expense, currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(bookData.closing_balance, currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
            visibility: visible !important;
          }
          main, main * {
            visibility: visible;
          }
          main {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          nav, aside, header, footer {
            display: none !important;
          }
          table {
            font-size: 11px;
          }
          th, td {
            padding: 4px 8px !important;
          }
        }
      `}</style>
    </div>
  )
}

export default function CashBookPage() {
  return (
    <Suspense fallback={<div>Nacitavanie...</div>}>
      <CashBookPageContent />
    </Suspense>
  )
}

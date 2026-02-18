"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  Calculator,
  Save,
  FileCode,
  Download,
  Loader2,
  Building,
  User,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Plus,
  Eye,
} from "lucide-react"
import { XmlPreviewDialog } from "@/components/tax/xml-preview-dialog"
import { XmlValidationAlert } from "@/components/tax/xml-validation-alert"
import { validateBeforeDownload } from "@/lib/edane/xml-validator"

// ===================== DPPO Types =====================

interface DPPOData {
  accounting_profit: number
  total_revenues: number
  total_expenses: number
  non_deductible_expenses: number
  excess_depreciation: number
  unpaid_liabilities: number
  tax_exempt_income: number
  tax_base: number
  tax_loss_deduction: number
  adjusted_tax_base: number
  tax_rate: number
  tax_amount: number
  prepayments_paid: number
  tax_to_pay: number
}

// ===================== DPFO Types =====================

interface DPFOData {
  business_income: number
  expense_type: "actual" | "flat_rate"
  actual_expenses: number
  flat_rate_expenses: number
  expenses_used: number
  partial_tax_base: number
  personal_allowance: number
  spouse_allowance: number
  pension_insurance: number
  total_non_taxable: number
  tax_base: number
  tax_rate_19: number
  tax_rate_25: number
  tax_amount: number
  child_bonus: number
  employee_bonus: number
  final_tax: number
  prepayments_paid: number
  tax_to_pay: number
}

interface TaxReturn {
  id: string
  type: string
  period_from: string
  period_to: string
  status: string
  recognition_type: string
  xml_content: string | null
  data: any
  created_at: string
}

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("sk-SK").format(new Date(dateStr))
}

const statusLabels: Record<string, string> = {
  draft: "Navrh",
  submitted: "Odoslany",
  accepted: "Prijaty",
}

const recognitionLabels: Record<string, string> = {
  riadne: "Riadne",
  opravne: "Opravne",
  dodatocne: "Dodatocne",
}

export default function IncomeTaxPage() {
  const { activeCompanyId, activeCompany } = useCompany()
  const { toast } = useToast()

  // Tab state: dppo or dpfo
  const [activeTab, setActiveTab] = useState<"dppo" | "dpfo">("dppo")

  // Determine default tab based on company business_type
  useEffect(() => {
    if (activeCompany?.business_type === "szco") {
      setActiveTab("dpfo")
    } else {
      setActiveTab("dppo")
    }
  }, [activeCompany])

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dan z prijmov</h1>
          <p className="text-muted-foreground">
            Danove priznanie k dani z prijmov pravnickych a fyzickych osob
          </p>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-1 mb-6 border-b">
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "dppo"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
          }`}
          onClick={() => setActiveTab("dppo")}
        >
          <Building className="h-4 w-4" />
          DPPO (Pravnicke osoby)
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "dpfo"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
          }`}
          onClick={() => setActiveTab("dpfo")}
        >
          <User className="h-4 w-4" />
          DPFO (Fyzicke osoby)
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "dppo" ? (
        <DPPOTab />
      ) : (
        <DPFOTab />
      )}
    </div>
  )
}

// ===================== DPPO Tab =====================

function DPPOTab() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear - 1)
  const [recognitionType, setRecognitionType] = useState("riadne")

  // Adjustments
  const [nonDeductible, setNonDeductible] = useState("")
  const [excessDepreciation, setExcessDepreciation] = useState("")
  const [unpaidLiabilities, setUnpaidLiabilities] = useState("")
  const [taxExempt, setTaxExempt] = useState("")
  const [lossDeduction, setLossDeduction] = useState("")
  const [prepayments, setPrepayments] = useState("")

  // Results
  const [dppoData, setDppoData] = useState<DPPOData | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)

  // XML preview & validation
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewXml, setPreviewXml] = useState("")
  const [validationResult, setValidationResult] = useState<any>(null)

  // Previous returns
  const [previousReturns, setPreviousReturns] = useState<TaxReturn[]>([])
  const [loadingReturns, setLoadingReturns] = useState(true)

  const fetchReturns = useCallback(async () => {
    if (!activeCompanyId) return
    setLoadingReturns(true)
    try {
      const res = await fetch(`/api/tax-returns/dppo?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setPreviousReturns(json.data || [])
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingReturns(false)
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchReturns()
  }, [fetchReturns])

  const handleCalculate = async () => {
    if (!activeCompanyId) return
    setCalculating(true)

    try {
      const res = await fetch("/api/tax-returns/dppo/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          year,
          adjustments: {
            non_deductible: parseFloat(nonDeductible) || 0,
            excess_depreciation: parseFloat(excessDepreciation) || 0,
            unpaid_liabilities: parseFloat(unpaidLiabilities) || 0,
            tax_exempt: parseFloat(taxExempt) || 0,
            loss_deduction: parseFloat(lossDeduction) || 0,
            prepayments: parseFloat(prepayments) || 0,
          },
        }),
      })

      const json = await res.json()

      if (res.ok) {
        setDppoData(json.data)
        toast({ title: "DPPO vypocitane" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa vypocitat DPPO" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vypocitat DPPO" })
    } finally {
      setCalculating(false)
    }
  }

  const handleSave = async (generateXml = false) => {
    if (!activeCompanyId || !dppoData) return
    setSaving(true)

    try {
      const res = await fetch("/api/tax-returns/dppo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          year,
          recognition_type: recognitionType,
          generate_xml: generateXml,
          dppo_data: dppoData,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        toast({ title: generateXml ? "DPPO ulozene a XML vygenerovane" : "DPPO ulozene" })
        fetchReturns()

        if (generateXml && json.xml_content) {
          downloadXml(json.xml_content, `DPPO_${year}.xml`)
          const result = validateBeforeDownload(json.xml_content, "dppo")
          setValidationResult(result)
          setPreviewXml(json.xml_content)
        }
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa ulozit DPPO" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit DPPO" })
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadXml = (taxReturn: TaxReturn) => {
    if (!taxReturn.xml_content) {
      toast({ variant: "destructive", title: "Chyba", description: "XML nebolo vygenerovane" })
      return
    }
    downloadXml(taxReturn.xml_content, `DPPO_${taxReturn.period_from.substring(0, 4)}.xml`)
  }

  return (
    <>
      {/* Parameters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Parametre</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div>
              <Label>Zdanovacie obdobie (rok)</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || currentYear - 1)}
                className="w-24 mt-1"
                min={2020}
                max={2030}
              />
            </div>
            <div>
              <Label>Druh priznania</Label>
              <select
                value={recognitionType}
                onChange={(e) => setRecognitionType(e.target.value)}
                className="flex h-9 mt-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="riadne">Riadne</option>
                <option value="opravne">Opravne</option>
                <option value="dodatocne">Dodatocne</option>
              </select>
            </div>
            <Button onClick={handleCalculate} disabled={calculating || !activeCompanyId}>
              {calculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-2 h-4 w-4" />
              )}
              Vypocitat
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Adjustments */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Upravy zakladu dane</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-1">
                <Plus className="h-3 w-3 text-red-500" />
                Nedanove naklady
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={nonDeductible}
                onChange={(e) => setNonDeductible(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Naklady na reprezentaciu, dary, pokuty (513, 543, 545...)</p>
            </div>
            <div>
              <Label className="flex items-center gap-1">
                <Plus className="h-3 w-3 text-red-500" />
                Nadmerne odpisy
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={excessDepreciation}
                onChange={(e) => setExcessDepreciation(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Odpisy prevysujuce danove odpisy</p>
            </div>
            <div>
              <Label className="flex items-center gap-1">
                <Plus className="h-3 w-3 text-red-500" />
                Neuhradene zavazky
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={unpaidLiabilities}
                onChange={(e) => setUnpaidLiabilities(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Zavazky po splatnosti viac ako 360 dni</p>
            </div>
            <div>
              <Label className="flex items-center gap-1">
                <Minus className="h-3 w-3 text-green-500" />
                Oslobodene prijmy
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={taxExempt}
                onChange={(e) => setTaxExempt(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Prijmy oslobodene od dane</p>
            </div>
            <div>
              <Label className="flex items-center gap-1">
                <Minus className="h-3 w-3 text-green-500" />
                Odpocet danovej straty
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={lossDeduction}
                onChange={(e) => setLossDeduction(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Max 50% zakladu dane, max 5 rokov</p>
            </div>
            <div>
              <Label className="flex items-center gap-1">
                <Minus className="h-3 w-3 text-blue-500" />
                Zaplatene preddavky
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={prepayments}
                onChange={(e) => setPrepayments(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Preddavky zaplatene pocas zdanovacieho obdobia</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {dppoData && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Vysledok vypoctu DPPO za rok {year}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {/* Accounting results */}
                <div className="grid grid-cols-2 gap-2 py-2 border-b">
                  <span className="font-medium">Vynosy (trieda 6)</span>
                  <span className="text-right font-mono">{formatMoney(dppoData.total_revenues)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 py-2 border-b">
                  <span className="font-medium">Naklady (trieda 5)</span>
                  <span className="text-right font-mono">{formatMoney(dppoData.total_expenses)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 py-2 border-b bg-muted/30 px-2 rounded">
                  <span className="font-semibold">Vysledok hospodarenia</span>
                  <span className={`text-right font-mono font-semibold ${dppoData.accounting_profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatMoney(dppoData.accounting_profit)}
                  </span>
                </div>

                {/* Adjustments */}
                <div className="pt-3 pb-1">
                  <span className="text-sm font-medium text-muted-foreground">Pripocitatelne polozky (+)</span>
                </div>
                {dppoData.non_deductible_expenses > 0 && (
                  <div className="grid grid-cols-2 gap-2 py-1 pl-4">
                    <span className="flex items-center gap-1 text-sm">
                      <ArrowUpRight className="h-3 w-3 text-red-500" />
                      Nedanove naklady
                    </span>
                    <span className="text-right font-mono text-sm text-red-600">+{formatMoney(dppoData.non_deductible_expenses)}</span>
                  </div>
                )}
                {dppoData.excess_depreciation > 0 && (
                  <div className="grid grid-cols-2 gap-2 py-1 pl-4">
                    <span className="flex items-center gap-1 text-sm">
                      <ArrowUpRight className="h-3 w-3 text-red-500" />
                      Nadmerne odpisy
                    </span>
                    <span className="text-right font-mono text-sm text-red-600">+{formatMoney(dppoData.excess_depreciation)}</span>
                  </div>
                )}
                {dppoData.unpaid_liabilities > 0 && (
                  <div className="grid grid-cols-2 gap-2 py-1 pl-4">
                    <span className="flex items-center gap-1 text-sm">
                      <ArrowUpRight className="h-3 w-3 text-red-500" />
                      Neuhradene zavazky
                    </span>
                    <span className="text-right font-mono text-sm text-red-600">+{formatMoney(dppoData.unpaid_liabilities)}</span>
                  </div>
                )}

                <div className="pt-2 pb-1">
                  <span className="text-sm font-medium text-muted-foreground">Odpocitatelne polozky (-)</span>
                </div>
                {dppoData.tax_exempt_income > 0 && (
                  <div className="grid grid-cols-2 gap-2 py-1 pl-4">
                    <span className="flex items-center gap-1 text-sm">
                      <ArrowDownRight className="h-3 w-3 text-green-500" />
                      Oslobodene prijmy
                    </span>
                    <span className="text-right font-mono text-sm text-green-600">-{formatMoney(dppoData.tax_exempt_income)}</span>
                  </div>
                )}

                {/* Tax base */}
                <div className="grid grid-cols-2 gap-2 py-2 border-t border-b mt-2">
                  <span className="font-medium">Zaklad dane</span>
                  <span className="text-right font-mono">{formatMoney(dppoData.tax_base)}</span>
                </div>
                {dppoData.tax_loss_deduction > 0 && (
                  <div className="grid grid-cols-2 gap-2 py-1 pl-4">
                    <span className="flex items-center gap-1 text-sm">
                      <ArrowDownRight className="h-3 w-3 text-green-500" />
                      Odpocet straty
                    </span>
                    <span className="text-right font-mono text-sm text-green-600">-{formatMoney(dppoData.tax_loss_deduction)}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 py-2 border-b bg-muted/30 px-2 rounded">
                  <span className="font-semibold">Upraveny zaklad dane</span>
                  <span className="text-right font-mono font-semibold">{formatMoney(dppoData.adjusted_tax_base)}</span>
                </div>

                {/* Tax calculation */}
                <div className="grid grid-cols-2 gap-2 py-2 border-b">
                  <span className="font-medium">Sadzba dane</span>
                  <span className="text-right font-mono">{dppoData.tax_rate}%</span>
                </div>
                <div className="grid grid-cols-2 gap-2 py-2 border-b bg-primary/5 px-2 rounded">
                  <span className="font-semibold">Dan</span>
                  <span className="text-right font-mono font-semibold">{formatMoney(dppoData.tax_amount)}</span>
                </div>
                {dppoData.prepayments_paid > 0 && (
                  <div className="grid grid-cols-2 gap-2 py-2 border-b">
                    <span className="font-medium">Zaplatene preddavky</span>
                    <span className="text-right font-mono text-green-600">-{formatMoney(dppoData.prepayments_paid)}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 py-3 bg-primary/10 px-2 rounded mt-2">
                  <span className="font-bold text-lg">
                    {dppoData.tax_to_pay >= 0 ? "Doplatok" : "Preplatok"}
                  </span>
                  <span className={`text-right font-mono font-bold text-lg ${dppoData.tax_to_pay >= 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatMoney(Math.abs(dppoData.tax_to_pay))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => handleSave(false)} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Ulozit
                </Button>
                <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>
                  <FileCode className="mr-2 h-4 w-4" />
                  Generovat XML
                </Button>
                <Button variant="outline" onClick={() => { if (previewXml) setPreviewOpen(true) }} disabled={!previewXml}>
                  <Eye className="mr-2 h-4 w-4" />
                  Nahlad XML
                </Button>
              </div>
              <XmlValidationAlert result={validationResult} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Previous Returns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Predchadzajuce DPPO priznania</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Obdobie</th>
                  <th className="h-10 px-4 text-left font-medium">Druh</th>
                  <th className="h-10 px-4 text-left font-medium">Stav</th>
                  <th className="h-10 px-4 text-right font-medium">Dan</th>
                  <th className="h-10 px-4 text-left font-medium">Vytvorene</th>
                  <th className="h-10 px-4 text-center font-medium">XML</th>
                </tr>
              </thead>
              <tbody>
                {loadingReturns ? (
                  <tr>
                    <td colSpan={6} className="h-16 text-center text-muted-foreground">
                      Nacitavam...
                    </td>
                  </tr>
                ) : previousReturns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-16 text-center text-muted-foreground">
                      Ziadne predchadzajuce DPPO priznania.
                    </td>
                  </tr>
                ) : (
                  previousReturns.map((ret) => {
                    const retData = ret.data as DPPOData | null
                    return (
                      <tr key={ret.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2">
                          {ret.period_from.substring(0, 4)}
                        </td>
                        <td className="px-4 py-2">
                          {recognitionLabels[ret.recognition_type] || ret.recognition_type}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            ret.status === "submitted"
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                          }`}>
                            {statusLabels[ret.status] || ret.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {retData ? formatMoney(retData.tax_amount) : "-"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {formatDate(ret.created_at)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {ret.xml_content ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPreviewXml(ret.xml_content!)
                                  setPreviewOpen(true)
                                  const result = validateBeforeDownload(ret.xml_content!, "dppo")
                                  setValidationResult(result)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadXml(ret)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <XmlPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        xmlContent={previewXml}
        title="DPPO - XML nahlad"
        filename={`DPPO_${year}.xml`}
      />
    </>
  )
}

// ===================== DPFO Tab =====================

function DPFOTab() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear - 1)
  const [recognitionType, setRecognitionType] = useState("riadne")

  // Input fields
  const [income, setIncome] = useState("")
  const [expenseType, setExpenseType] = useState<"actual" | "flat_rate">("flat_rate")
  const [actualExpenses, setActualExpenses] = useState("")
  const [childrenCount, setChildrenCount] = useState("")
  const [spouseIncome, setSpouseIncome] = useState("")
  const [pensionInsurance, setPensionInsurance] = useState("")
  const [prepayments, setPrepayments] = useState("")

  // Results
  const [dpfoData, setDpfoData] = useState<DPFOData | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)

  // XML preview & validation
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewXml, setPreviewXml] = useState("")
  const [validationResult, setValidationResult] = useState<any>(null)

  // Previous returns
  const [previousReturns, setPreviousReturns] = useState<TaxReturn[]>([])
  const [loadingReturns, setLoadingReturns] = useState(true)

  const fetchReturns = useCallback(async () => {
    if (!activeCompanyId) return
    setLoadingReturns(true)
    try {
      const res = await fetch(`/api/tax-returns/dpfo?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setPreviousReturns(json.data || [])
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingReturns(false)
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchReturns()
  }, [fetchReturns])

  const handleCalculate = async () => {
    if (!activeCompanyId) return
    setCalculating(true)

    try {
      const res = await fetch("/api/tax-returns/dpfo/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          year,
          income: parseFloat(income) || 0,
          expense_type: expenseType,
          actual_expenses: parseFloat(actualExpenses) || 0,
          children_count: parseInt(childrenCount) || 0,
          spouse_income: parseFloat(spouseIncome) || 0,
          pension_insurance: parseFloat(pensionInsurance) || 0,
          prepayments: parseFloat(prepayments) || 0,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        setDpfoData(json.data)
        toast({ title: "DPFO vypocitane" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa vypocitat DPFO" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vypocitat DPFO" })
    } finally {
      setCalculating(false)
    }
  }

  const handleSave = async (generateXml = false) => {
    if (!activeCompanyId || !dpfoData) return
    setSaving(true)

    try {
      const res = await fetch("/api/tax-returns/dpfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          year,
          recognition_type: recognitionType,
          generate_xml: generateXml,
          dpfo_data: dpfoData,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        toast({ title: generateXml ? "DPFO ulozene a XML vygenerovane" : "DPFO ulozene" })
        fetchReturns()

        if (generateXml && json.xml_content) {
          downloadXml(json.xml_content, `DPFO_${year}.xml`)
          const result = validateBeforeDownload(json.xml_content, "dpfo")
          setValidationResult(result)
          setPreviewXml(json.xml_content)
        }
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa ulozit DPFO" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit DPFO" })
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadXml = (taxReturn: TaxReturn) => {
    if (!taxReturn.xml_content) {
      toast({ variant: "destructive", title: "Chyba", description: "XML nebolo vygenerovane" })
      return
    }
    downloadXml(taxReturn.xml_content, `DPFO_${taxReturn.period_from.substring(0, 4)}.xml`)
  }

  return (
    <>
      {/* Parameters & Inputs */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Parametre</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div>
              <Label>Zdanovacie obdobie (rok)</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || currentYear - 1)}
                className="w-24 mt-1"
                min={2020}
                max={2030}
              />
            </div>
            <div>
              <Label>Druh priznania</Label>
              <select
                value={recognitionType}
                onChange={(e) => setRecognitionType(e.target.value)}
                className="flex h-9 mt-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="riadne">Riadne</option>
                <option value="opravne">Opravne</option>
                <option value="dodatocne">Dodatocne</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Income & Expenses */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Prijmy a vydavky (par. 6)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Prijmy z podnikania</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Celkove prijmy z podnikatelskej cinnosti</p>
            </div>

            <div>
              <Label>Typ vydavkov</Label>
              <div className="flex gap-1 mt-1">
                <Button
                  variant={expenseType === "flat_rate" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setExpenseType("flat_rate")}
                >
                  Pausalne vydavky (60%)
                </Button>
                <Button
                  variant={expenseType === "actual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setExpenseType("actual")}
                >
                  Skutocne vydavky
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {expenseType === "flat_rate" ? "60% z prijmov, max 20 000 EUR" : "Skutocne preukazatelne vydavky"}
              </p>
            </div>

            {expenseType === "actual" && (
              <div>
                <Label>Skutocne vydavky</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={actualExpenses}
                  onChange={(e) => setActualExpenses(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Nezdanitelne casti */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Nezdanitelne casti a bonus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Nezdanitelna cast na danovnika</Label>
              <div className="mt-1 py-2 px-3 rounded-md bg-muted/50 text-sm">
                Automaticky vypocitana
              </div>
              <p className="text-xs text-muted-foreground mt-1">Podla vysky zakladu dane</p>
            </div>
            <div>
              <Label>Prijem manzela/manzelky (rocny)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={spouseIncome}
                onChange={(e) => setSpouseIncome(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Pre vypocet nezdanitelnej casti na manzela/ku</p>
            </div>
            <div>
              <Label>Dobrovolne dochodkove poistenie</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={pensionInsurance}
                onChange={(e) => setPensionInsurance(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Max 180 EUR</p>
            </div>
            <div>
              <Label>Pocet vyzirovanych deti</Label>
              <Input
                type="number"
                step="1"
                placeholder="0"
                value={childrenCount}
                onChange={(e) => setChildrenCount(e.target.value)}
                className="mt-1"
                min={0}
              />
              <p className="text-xs text-muted-foreground mt-1">Pre danovy bonus na dieta (140 EUR/mesiac)</p>
            </div>
            <div>
              <Label>Zaplatene preddavky na dan</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={prepayments}
                onChange={(e) => setPrepayments(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="mt-6">
            <Button onClick={handleCalculate} disabled={calculating || !activeCompanyId}>
              {calculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-2 h-4 w-4" />
              )}
              Vypocitat DPFO
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {dpfoData && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Vysledok vypoctu DPFO za rok {year}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {/* Income & Expenses */}
                <div className="grid grid-cols-2 gap-2 py-2 border-b">
                  <span className="font-medium">Prijmy z podnikania</span>
                  <span className="text-right font-mono">{formatMoney(dpfoData.business_income)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 py-2 border-b">
                  <span className="font-medium">
                    Vydavky ({dpfoData.expense_type === "flat_rate" ? "pausalne 60%" : "skutocne"})
                  </span>
                  <span className="text-right font-mono">{formatMoney(dpfoData.expenses_used)}</span>
                </div>
                {dpfoData.expense_type === "flat_rate" && (
                  <div className="grid grid-cols-2 gap-2 py-1 pl-4 text-sm text-muted-foreground">
                    <span>Pausalne vydavky (60%, max 20 000)</span>
                    <span className="text-right font-mono">{formatMoney(dpfoData.flat_rate_expenses)}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 py-2 border-b bg-muted/30 px-2 rounded">
                  <span className="font-semibold">Dielci zaklad dane (par. 6)</span>
                  <span className="text-right font-mono font-semibold">{formatMoney(dpfoData.partial_tax_base)}</span>
                </div>

                {/* Non-taxable parts */}
                <div className="pt-3 pb-1">
                  <span className="text-sm font-medium text-muted-foreground">Nezdanitelne casti zakladu dane</span>
                </div>
                <div className="grid grid-cols-2 gap-2 py-1 pl-4">
                  <span className="text-sm">Na danovnika</span>
                  <span className="text-right font-mono text-sm text-green-600">-{formatMoney(dpfoData.personal_allowance)}</span>
                </div>
                {dpfoData.spouse_allowance > 0 && (
                  <div className="grid grid-cols-2 gap-2 py-1 pl-4">
                    <span className="text-sm">Na manzela/ku</span>
                    <span className="text-right font-mono text-sm text-green-600">-{formatMoney(dpfoData.spouse_allowance)}</span>
                  </div>
                )}
                {dpfoData.pension_insurance > 0 && (
                  <div className="grid grid-cols-2 gap-2 py-1 pl-4">
                    <span className="text-sm">Dochodkove poistenie</span>
                    <span className="text-right font-mono text-sm text-green-600">-{formatMoney(dpfoData.pension_insurance)}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 py-2 border-b pl-4">
                  <span className="font-medium text-sm">Celkom nezdanitelne</span>
                  <span className="text-right font-mono text-sm text-green-600">-{formatMoney(dpfoData.total_non_taxable)}</span>
                </div>

                {/* Tax base & calculation */}
                <div className="grid grid-cols-2 gap-2 py-2 border-b bg-muted/30 px-2 rounded">
                  <span className="font-semibold">Zaklad dane</span>
                  <span className="text-right font-mono font-semibold">{formatMoney(dpfoData.tax_base)}</span>
                </div>

                <div className="pt-2 pb-1">
                  <span className="text-sm font-medium text-muted-foreground">Vypocet dane</span>
                </div>
                {dpfoData.tax_rate_19 > 0 && (
                  <div className="grid grid-cols-2 gap-2 py-1 pl-4">
                    <span className="text-sm">19% z {formatMoney(dpfoData.tax_rate_19)}</span>
                    <span className="text-right font-mono text-sm">{formatMoney(dpfoData.tax_rate_19 * 0.19)}</span>
                  </div>
                )}
                {dpfoData.tax_rate_25 > 0 && (
                  <div className="grid grid-cols-2 gap-2 py-1 pl-4">
                    <span className="text-sm">25% z {formatMoney(dpfoData.tax_rate_25)}</span>
                    <span className="text-right font-mono text-sm">{formatMoney(dpfoData.tax_rate_25 * 0.25)}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 py-2 border-b bg-primary/5 px-2 rounded">
                  <span className="font-semibold">Dan</span>
                  <span className="text-right font-mono font-semibold">{formatMoney(dpfoData.tax_amount)}</span>
                </div>

                {/* Bonuses */}
                {dpfoData.child_bonus > 0 && (
                  <div className="grid grid-cols-2 gap-2 py-2 border-b">
                    <span className="font-medium">Danovy bonus na deti</span>
                    <span className="text-right font-mono text-green-600">-{formatMoney(dpfoData.child_bonus)}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 py-2 border-b">
                  <span className="font-medium">Dan po znizeni</span>
                  <span className="text-right font-mono">{formatMoney(dpfoData.final_tax)}</span>
                </div>

                {dpfoData.prepayments_paid > 0 && (
                  <div className="grid grid-cols-2 gap-2 py-2 border-b">
                    <span className="font-medium">Zaplatene preddavky</span>
                    <span className="text-right font-mono text-green-600">-{formatMoney(dpfoData.prepayments_paid)}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 py-3 bg-primary/10 px-2 rounded mt-2">
                  <span className="font-bold text-lg">
                    {dpfoData.tax_to_pay >= 0 ? "Doplatok" : "Preplatok"}
                  </span>
                  <span className={`text-right font-mono font-bold text-lg ${dpfoData.tax_to_pay >= 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatMoney(Math.abs(dpfoData.tax_to_pay))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => handleSave(false)} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Ulozit
                </Button>
                <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>
                  <FileCode className="mr-2 h-4 w-4" />
                  Generovat XML
                </Button>
                <Button variant="outline" onClick={() => { if (previewXml) setPreviewOpen(true) }} disabled={!previewXml}>
                  <Eye className="mr-2 h-4 w-4" />
                  Nahlad XML
                </Button>
              </div>
              <XmlValidationAlert result={validationResult} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Previous Returns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Predchadzajuce DPFO priznania</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Obdobie</th>
                  <th className="h-10 px-4 text-left font-medium">Druh</th>
                  <th className="h-10 px-4 text-left font-medium">Stav</th>
                  <th className="h-10 px-4 text-right font-medium">Dan</th>
                  <th className="h-10 px-4 text-left font-medium">Vytvorene</th>
                  <th className="h-10 px-4 text-center font-medium">XML</th>
                </tr>
              </thead>
              <tbody>
                {loadingReturns ? (
                  <tr>
                    <td colSpan={6} className="h-16 text-center text-muted-foreground">
                      Nacitavam...
                    </td>
                  </tr>
                ) : previousReturns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-16 text-center text-muted-foreground">
                      Ziadne predchadzajuce DPFO priznania.
                    </td>
                  </tr>
                ) : (
                  previousReturns.map((ret) => {
                    const retData = ret.data as DPFOData | null
                    return (
                      <tr key={ret.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2">
                          {ret.period_from.substring(0, 4)}
                        </td>
                        <td className="px-4 py-2">
                          {recognitionLabels[ret.recognition_type] || ret.recognition_type}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            ret.status === "submitted"
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                          }`}>
                            {statusLabels[ret.status] || ret.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {retData ? formatMoney(retData.final_tax) : "-"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {formatDate(ret.created_at)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {ret.xml_content ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPreviewXml(ret.xml_content!)
                                  setPreviewOpen(true)
                                  const result = validateBeforeDownload(ret.xml_content!, "dpfo")
                                  setValidationResult(result)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadXml(ret)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <XmlPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        xmlContent={previewXml}
        title="DPFO typ B - XML nahlad"
        filename={`DPFO_${year}.xml`}
      />
    </>
  )
}

// ===================== Shared utility =====================

function downloadXml(xmlContent: string, filename: string) {
  const blob = new Blob([xmlContent], { type: "application/xml" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

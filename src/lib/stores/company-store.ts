import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface Company {
  id: string
  name: string
  ico: string | null
  dic: string | null
  ic_dph: string | null
  business_type: string
  accounting_type: string
  is_vat_payer: boolean
  vat_period: "mesacne" | "stvrtrocne" | null
  logo_url: string | null
}

export interface UserCompanyRole {
  id: string
  company_id: string
  role: string
  is_default: boolean
  company: Company
}

interface CompanyState {
  companies: UserCompanyRole[]
  activeCompanyId: string | null
  activeCompany: Company | null
  activeRole: string | null
  setCompanies: (companies: UserCompanyRole[]) => void
  setActiveCompany: (companyId: string) => void
  clearCompany: () => void
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      companies: [],
      activeCompanyId: null,
      activeCompany: null,
      activeRole: null,

      setCompanies: (companies) => {
        const current = get()
        // Ak nie je nastavená aktívna firma, nastav predvolenú
        if (!current.activeCompanyId && companies.length > 0) {
          const defaultCompany = companies.find((c) => c.is_default) || companies[0]
          set({
            companies,
            activeCompanyId: defaultCompany.company_id,
            activeCompany: defaultCompany.company,
            activeRole: defaultCompany.role,
          })
        } else {
          // Aktualizovať companies ale zachovať aktívnu
          const active = companies.find((c) => c.company_id === current.activeCompanyId)
          set({
            companies,
            activeCompany: active?.company ?? null,
            activeRole: active?.role ?? null,
          })
        }
      },

      setActiveCompany: (companyId) => {
        const companies = get().companies
        const found = companies.find((c) => c.company_id === companyId)
        if (found) {
          set({
            activeCompanyId: companyId,
            activeCompany: found.company,
            activeRole: found.role,
          })
        }
      },

      clearCompany: () => {
        set({
          companies: [],
          activeCompanyId: null,
          activeCompany: null,
          activeRole: null,
        })
      },
    }),
    {
      name: "company-store",
      partialize: (state) => ({
        activeCompanyId: state.activeCompanyId,
      }),
    }
  )
)

"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompanyStore } from "@/lib/stores/company-store"
import { useAuth } from "@/hooks/use-auth"

export function useCompany() {
  const { user, loading: authLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const {
    companies,
    activeCompanyId,
    activeCompany,
    activeRole,
    setCompanies,
    setActiveCompany,
    clearCompany,
  } = useCompanyStore()

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/companies")
      if (res.ok) {
        const data = await res.json()
        const mapped = data.map((item: any) => ({
          id: item.id,
          company_id: item.company_id,
          role: item.role,
          is_default: item.is_default,
          company: item.company,
        }))
        setCompanies(mapped)
      }
    } catch {
      // Keep existing data on error
    }
    setIsLoading(false)
  }, [setCompanies])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      clearCompany()
      setIsLoading(false)
      return
    }

    fetchCompanies()
  }, [user, authLoading, fetchCompanies, clearCompany])

  const hasPermission = (requiredRoles: string[]) => {
    if (!activeRole) return false
    return requiredRoles.includes(activeRole)
  }

  const isAdmin = () => hasPermission(["admin"])
  const canWrite = () => hasPermission(["admin", "uctovnik", "fakturant", "mzdar", "skladnik"])
  const canRead = () => hasPermission(["admin", "uctovnik", "fakturant", "mzdar", "skladnik", "readonly"])

  return {
    companies,
    activeCompanyId,
    activeCompany,
    activeRole,
    setActiveCompany,
    hasPermission,
    isAdmin,
    canWrite,
    canRead,
    isLoading,
    hasCompanies: companies.length > 0,
    refetch: fetchCompanies,
  }
}

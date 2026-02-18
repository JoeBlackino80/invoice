"use client"

import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react"

interface ValidationError {
  line?: number
  message: string
  element?: string
}

interface ValidationWarning {
  line?: number
  message: string
  element?: string
}

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

interface XmlValidationAlertProps {
  result: ValidationResult | null
}

export function XmlValidationAlert({ result }: XmlValidationAlertProps) {
  if (!result) return null

  if (result.valid && result.warnings.length === 0) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-md bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800">
        <CheckCircle className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
        <p className="text-sm text-green-700 dark:text-green-300">
          XML je validne a pripravene na stiahnutie.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {result.errors.length > 0 && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              Chyby ({result.errors.length})
            </p>
          </div>
          <ul className="space-y-1 ml-6">
            {result.errors.map((err, i) => (
              <li key={i} className="text-xs text-red-600 dark:text-red-400">
                {err.line ? `Riadok ${err.line}: ` : ""}
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="p-3 rounded-md bg-yellow-50 border border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
              Upozornenia ({result.warnings.length})
            </p>
          </div>
          <ul className="space-y-1 ml-6">
            {result.warnings.map((warn, i) => (
              <li key={i} className="text-xs text-yellow-600 dark:text-yellow-400">
                {warn.line ? `Riadok ${warn.line}: ` : ""}
                {warn.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

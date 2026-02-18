/**
 * Error tracking and monitoring service.
 * Captures errors and reports them for monitoring.
 * In production, can be extended with Sentry, LogRocket, etc.
 */

import { logger } from "@/lib/logging/logger"
import { createAdminClient } from "@/lib/supabase/admin"

interface ErrorContext {
  userId?: string
  companyId?: string
  module?: string
  action?: string
  requestPath?: string
  requestMethod?: string
  metadata?: Record<string, unknown>
}

interface ErrorReport {
  id: string
  timestamp: string
  error: {
    name: string
    message: string
    stack?: string
  }
  context: ErrorContext
  severity: "low" | "medium" | "high" | "critical"
}

// In-memory error buffer for batch reporting
const errorBuffer: ErrorReport[] = []
const MAX_BUFFER_SIZE = 100

/**
 * Track an error with context
 */
export function trackError(
  error: unknown,
  context: ErrorContext = {},
  severity: ErrorReport["severity"] = "medium"
): string {
  const errorObj = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { name: "Error", message: String(error) }

  const report: ErrorReport = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    error: errorObj,
    context,
    severity,
  }

  // Log the error
  logger.error(`[${severity.toUpperCase()}] ${errorObj.message}`, error, {
    module: context.module,
    userId: context.userId,
    companyId: context.companyId,
    data: context.metadata,
  })

  // Add to buffer
  errorBuffer.push(report)
  if (errorBuffer.length > MAX_BUFFER_SIZE) {
    errorBuffer.shift() // Remove oldest
  }

  // For critical errors, flush immediately
  if (severity === "critical") {
    flushErrors().catch(() => {})
  }

  return report.id
}

/**
 * Flush error buffer to persistent storage
 */
export async function flushErrors(): Promise<number> {
  if (errorBuffer.length === 0) return 0

  const errors = [...errorBuffer]
  errorBuffer.length = 0

  try {
    const db = createAdminClient()

    const rows = errors.map((report) => ({
      error_id: report.id,
      timestamp: report.timestamp,
      error_name: report.error.name,
      error_message: report.error.message,
      error_stack: report.error.stack?.slice(0, 5000), // Limit stack trace size
      severity: report.severity,
      user_id: report.context.userId || null,
      company_id: report.context.companyId || null,
      module: report.context.module || null,
      action: report.context.action || null,
      request_path: report.context.requestPath || null,
      request_method: report.context.requestMethod || null,
      metadata: report.context.metadata || {},
    }))

    // Try to insert into error_reports table if it exists
    await (db.from("error_reports") as any).insert(rows)

    return errors.length
  } catch {
    // If table doesn't exist or insert fails, just log
    for (const report of errors) {
      console.error(`[ERROR_REPORT] ${report.severity}: ${report.error.message}`)
    }
    return 0
  }
}

/**
 * Get recent errors from buffer (for admin dashboard)
 */
export function getRecentErrors(): ErrorReport[] {
  return [...errorBuffer].reverse()
}

/**
 * API error handler wrapper
 */
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: Omit<ErrorContext, "metadata">
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      trackError(error, context, "high")
      throw error
    }
  }) as unknown as T
}

/**
 * Health check data
 */
export function getHealthMetrics(): {
  status: "healthy" | "degraded" | "unhealthy"
  errorRate: number
  recentErrors: number
  uptime: number
} {
  const recentErrors = errorBuffer.filter(
    (e) => Date.now() - new Date(e.timestamp).getTime() < 5 * 60 * 1000
  ).length

  const criticalErrors = errorBuffer.filter(
    (e) =>
      e.severity === "critical" &&
      Date.now() - new Date(e.timestamp).getTime() < 5 * 60 * 1000
  ).length

  let status: "healthy" | "degraded" | "unhealthy" = "healthy"
  if (criticalErrors > 0) status = "unhealthy"
  else if (recentErrors > 10) status = "degraded"

  return {
    status,
    errorRate: recentErrors,
    recentErrors: errorBuffer.length,
    uptime: process.uptime?.() || 0,
  }
}

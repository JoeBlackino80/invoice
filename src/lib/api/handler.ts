/**
 * Unified API route handler wrapper.
 * Provides consistent error handling, logging, auth, and response format.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createRequestLogger } from "@/lib/logging/logger"
import { trackError } from "@/lib/monitoring/error-tracker"
import type { SupabaseClient, User } from "@supabase/supabase-js"

export interface ApiContext {
  user: User
  db: SupabaseClient
  log: ReturnType<typeof createRequestLogger>
  params: Record<string, string>
}

type ApiHandler = (
  request: Request,
  ctx: ApiContext
) => Promise<NextResponse | Response>

interface HandlerOptions {
  /** Allow unauthenticated access (e.g. public endpoints, webhooks) */
  public?: boolean
}

/**
 * Wrap an API route handler with consistent error handling.
 *
 * Usage:
 *   export const GET = apiHandler(async (req, { user, db, log }) => {
 *     const { data, error } = await db.from("table").select("*")
 *     if (error) return NextResponse.json({ error: error.message }, { status: 500 })
 *     return NextResponse.json(data)
 *   })
 */
export function apiHandler(handler: ApiHandler, options?: HandlerOptions) {
  return async (request: Request, routeContext?: { params?: Record<string, string> }) => {
    const start = Date.now()
    const log = createRequestLogger(request)
    const params = routeContext?.params || {}

    try {
      // Auth check
      let user: User | null = null
      if (!options?.public) {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        user = data.user

        if (!user) {
          log.done(401, Date.now() - start)
          return NextResponse.json(
            { error: "Neautorizovaný prístup" },
            { status: 401 }
          )
        }
      }

      const db = createAdminClient()
      const ctx: ApiContext = { user: user!, db, log, params }

      const response = await handler(request, ctx)

      // Log completion
      const status = response instanceof NextResponse
        ? response.status
        : (response as any).status || 200
      log.done(status, Date.now() - start)

      return response
    } catch (error) {
      const durationMs = Date.now() - start
      const url = new URL(request.url)

      // Track the error
      trackError(error, {
        requestPath: url.pathname,
        requestMethod: request.method,
      }, "high")

      log.error("Unhandled API error", error)
      log.done(500, durationMs)

      // Don't expose internal error details in production
      const message = process.env.NODE_ENV === "production"
        ? "Interná chyba servera"
        : error instanceof Error ? error.message : "Neznáma chyba"

      return NextResponse.json(
        { error: message, requestId: log.requestId },
        { status: 500 }
      )
    }
  }
}

import { updateSession } from "@/lib/supabase/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { checkRateLimit, getRateLimitKey, getRateLimitConfig, rateLimitHeaders } from "@/lib/security/rate-limiter"

export async function middleware(request: NextRequest) {
  // Rate limiting for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const key = getRateLimitKey(request)
    const config = getRateLimitConfig(request.nextUrl.pathname)
    const result = checkRateLimit(key, config)

    if (!result.allowed) {
      return NextResponse.json(
        { error: "Príliš veľa požiadaviek. Skúste neskôr." },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders(result),
            "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          },
        }
      )
    }

    // Add rate limit headers to successful response
    const sessionResponse = await updateSession(request)
    const headers = rateLimitHeaders(result)
    for (const [key, value] of Object.entries(headers)) {
      sessionResponse.headers.set(key, value)
    }

    // Add request ID for tracing
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID()
    sessionResponse.headers.set("X-Request-ID", requestId)

    return sessionResponse
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

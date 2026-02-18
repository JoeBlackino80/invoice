/**
 * In-memory rate limiter for API endpoints.
 * Uses a sliding window approach with token bucket.
 * In production with multiple instances, replace with Redis-based limiter.
 */

interface RateLimitEntry {
  tokens: number
  lastRefill: number
}

interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number
  /** Window in seconds */
  windowSeconds: number
}

// In-memory store (per-instance; for multi-instance use Redis)
const store = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup(windowMs: number): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [key, entry] of store.entries()) {
    if (now - entry.lastRefill > windowMs * 2) {
      store.delete(key)
    }
  }
}

/**
 * Predefined rate limit configs for different endpoint types
 */
export const RATE_LIMITS = {
  /** Standard API endpoints: 60 req/min */
  api: { maxRequests: 60, windowSeconds: 60 },
  /** Auth endpoints: 10 req/min */
  auth: { maxRequests: 10, windowSeconds: 60 },
  /** AI/OCR endpoints: 10 req/min */
  ai: { maxRequests: 10, windowSeconds: 60 },
  /** Webhook endpoints: 100 req/min */
  webhook: { maxRequests: 100, windowSeconds: 60 },
  /** File upload: 20 req/min */
  upload: { maxRequests: 20, windowSeconds: 60 },
  /** Portal: 30 req/min */
  portal: { maxRequests: 30, windowSeconds: 60 },
} as const

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  resetAt: number
}

/**
 * Check rate limit for a given key (e.g., IP address + endpoint).
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = RATE_LIMITS.api
): RateLimitResult {
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000

  cleanup(windowMs)

  let entry = store.get(key)

  if (!entry) {
    entry = { tokens: config.maxRequests, lastRefill: now }
    store.set(key, entry)
  }

  // Refill tokens based on elapsed time
  const elapsed = now - entry.lastRefill
  const tokensToAdd = Math.floor((elapsed / windowMs) * config.maxRequests)

  if (tokensToAdd > 0) {
    entry.tokens = Math.min(config.maxRequests, entry.tokens + tokensToAdd)
    entry.lastRefill = now
  }

  const resetAt = entry.lastRefill + windowMs

  if (entry.tokens > 0) {
    entry.tokens--
    return {
      allowed: true,
      remaining: entry.tokens,
      limit: config.maxRequests,
      resetAt,
    }
  }

  return {
    allowed: false,
    remaining: 0,
    limit: config.maxRequests,
    resetAt,
  }
}

/**
 * Get rate limit key from request (IP + path prefix)
 */
export function getRateLimitKey(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown"
  const url = new URL(request.url)
  // Group by first two path segments: /api/invoices/* → /api/invoices
  const pathParts = url.pathname.split("/").filter(Boolean).slice(0, 2)
  return `${ip}:${pathParts.join("/")}`
}

/**
 * Get rate limit config for a request path
 */
export function getRateLimitConfig(pathname: string): RateLimitConfig {
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/portal/auth")) {
    return RATE_LIMITS.auth
  }
  if (pathname.startsWith("/api/ai") || pathname.startsWith("/api/documents") && pathname.includes("ocr")) {
    return RATE_LIMITS.ai
  }
  if (pathname.startsWith("/api/payments/webhook") || pathname.startsWith("/api/integrations/webhooks")) {
    return RATE_LIMITS.webhook
  }
  if (pathname.includes("/upload")) {
    return RATE_LIMITS.upload
  }
  if (pathname.startsWith("/api/portal")) {
    return RATE_LIMITS.portal
  }
  return RATE_LIMITS.api
}

/**
 * Create rate limit headers for the response
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  }
}

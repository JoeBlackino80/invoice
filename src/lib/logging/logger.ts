/**
 * Centralized structured logger for the application.
 * Outputs JSON logs in production, pretty logs in development.
 * Integrates with Vercel Log Drain for production monitoring.
 */

export type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  /** Module/component name */
  module?: string
  /** Request ID for tracing */
  requestId?: string
  /** User ID if available */
  userId?: string
  /** Company ID if available */
  companyId?: string
  /** HTTP method */
  method?: string
  /** Request path */
  path?: string
  /** HTTP status code */
  statusCode?: number
  /** Duration in ms */
  durationMs?: number
  /** Error details */
  error?: {
    name: string
    message: string
    stack?: string
  }
  /** Additional data */
  data?: Record<string, unknown>
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL = process.env.LOG_LEVEL as LogLevel || (process.env.NODE_ENV === "production" ? "info" : "debug")

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL]
}

function formatLog(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    // JSON format for Vercel Log Drain / external log aggregators
    return JSON.stringify(entry)
  }

  // Pretty format for development
  const levelColors: Record<LogLevel, string> = {
    debug: "\x1b[90m",   // gray
    info: "\x1b[36m",    // cyan
    warn: "\x1b[33m",    // yellow
    error: "\x1b[31m",   // red
  }
  const reset = "\x1b[0m"
  const color = levelColors[entry.level]

  let line = `${color}[${entry.level.toUpperCase()}]${reset}`
  if (entry.module) line += ` [${entry.module}]`
  line += ` ${entry.message}`
  if (entry.durationMs !== undefined) line += ` (${entry.durationMs}ms)`
  if (entry.statusCode) line += ` → ${entry.statusCode}`
  if (entry.error) line += `\n  Error: ${entry.error.message}`

  return line
}

function log(level: LogLevel, message: string, extra?: Partial<Omit<LogEntry, "level" | "message" | "timestamp">>): void {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  }

  const formatted = formatLog(entry)

  switch (level) {
    case "error":
      console.error(formatted)
      break
    case "warn":
      console.warn(formatted)
      break
    default:
      console.log(formatted)
  }
}

export const logger = {
  debug: (message: string, extra?: Partial<Omit<LogEntry, "level" | "message" | "timestamp">>) =>
    log("debug", message, extra),
  info: (message: string, extra?: Partial<Omit<LogEntry, "level" | "message" | "timestamp">>) =>
    log("info", message, extra),
  warn: (message: string, extra?: Partial<Omit<LogEntry, "level" | "message" | "timestamp">>) =>
    log("warn", message, extra),
  error: (message: string, err?: unknown, extra?: Partial<Omit<LogEntry, "level" | "message" | "timestamp">>) => {
    const errorData = err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : err
        ? { name: "Error", message: String(err) }
        : undefined
    log("error", message, { ...extra, error: errorData })
  },
}

/**
 * Create a request-scoped logger with context
 */
export function createRequestLogger(request: Request, extra?: { userId?: string; companyId?: string }) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID()
  const url = new URL(request.url)

  return {
    debug: (message: string, data?: Record<string, unknown>) =>
      logger.debug(message, { requestId, method: request.method, path: url.pathname, ...extra, data }),
    info: (message: string, data?: Record<string, unknown>) =>
      logger.info(message, { requestId, method: request.method, path: url.pathname, ...extra, data }),
    warn: (message: string, data?: Record<string, unknown>) =>
      logger.warn(message, { requestId, method: request.method, path: url.pathname, ...extra, data }),
    error: (message: string, err?: unknown, data?: Record<string, unknown>) =>
      logger.error(message, err, { requestId, method: request.method, path: url.pathname, ...extra, data }),
    /** Log request completion with duration */
    done: (statusCode: number, durationMs: number) =>
      logger.info(`${request.method} ${url.pathname} → ${statusCode}`, {
        requestId,
        method: request.method,
        path: url.pathname,
        statusCode,
        durationMs,
        ...extra,
      }),
    requestId,
  }
}

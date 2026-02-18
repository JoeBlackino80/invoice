import { NextResponse } from "next/server"
import { getHealthMetrics } from "@/lib/monitoring/error-tracker"

/**
 * GET /api/health - Health check endpoint for monitoring
 */
export async function GET() {
  const metrics = getHealthMetrics()

  const statusCode = metrics.status === "healthy" ? 200 : metrics.status === "degraded" ? 200 : 503

  return NextResponse.json({
    status: metrics.status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    uptime: Math.round(metrics.uptime),
    errorRate: metrics.errorRate,
    recentErrors: metrics.recentErrors,
  }, { status: statusCode })
}

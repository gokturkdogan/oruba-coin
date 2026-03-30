import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/middleware"
import {
  getWorkerFlyAppName,
  getWorkerFlyMachineIdFilter,
  listFlyMachinesForApp,
  summarizeFlyMachineStates,
  type FlyMachinesAggregate,
  type FlyMachineSummary,
} from "@/lib/fly-worker-machines"

export const runtime = "nodejs"

export type WorkerStatusResponse =
  | {
      configured: true
      appName: string
      summary: FlyMachinesAggregate
      machines: FlyMachineSummary[]
      checkedAt: string
    }
  | { configured: false; error: string }

/**
 * GET /api/admin/worker-status
 * Fly.io machine state(s) for the volume worker app.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const token = process.env.FLY_API_TOKEN
    if (!token) {
      const body: WorkerStatusResponse = {
        configured: false,
        error: "FLY_API_TOKEN is not configured on the server",
      }
      return NextResponse.json(body, { status: 200 })
    }

    const appName = getWorkerFlyAppName()
    const machineFilter = getWorkerFlyMachineIdFilter()

    const listed = await listFlyMachinesForApp(token, appName)
    if (!listed.ok) {
      console.error("[worker-status] List failed", listed.status, listed.message)
      return NextResponse.json(
        {
          error: "Could not list Fly machines",
          detail: `${listed.status} ${listed.message}`,
        },
        { status: 502 }
      )
    }

    let machines = listed.machines
    if (machineFilter) {
      machines = machines.filter((m) => m.id === machineFilter)
    }

    const summary = summarizeFlyMachineStates(machines)

    const body: WorkerStatusResponse = {
      configured: true,
      appName,
      summary,
      machines,
      checkedAt: new Date().toISOString(),
    }

    return NextResponse.json(body)
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[worker-status]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

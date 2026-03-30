import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/middleware"
import { getWorkerFlyAppName, getWorkerFlyMachineIdFilter, listFlyMachinesForApp, MACHINES_API } from "@/lib/fly-worker-machines"

export const runtime = "nodejs"

/**
 * POST /api/admin/restart-worker
 * Restarts Fly.io machines for the volume worker app so it reloads settings/subscriptions from DB.
 * Requires FLY_API_TOKEN (fly auth token with machines scope).
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const token = process.env.FLY_API_TOKEN
    if (!token) {
      return NextResponse.json(
        { error: "FLY_API_TOKEN is not configured on the server" },
        { status: 500 }
      )
    }

    const appName = getWorkerFlyAppName()
    const singleMachineId = getWorkerFlyMachineIdFilter()

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }

    let machineIds: string[] = []

    if (singleMachineId) {
      machineIds = [singleMachineId]
    } else {
      const listed = await listFlyMachinesForApp(token, appName)
      if (!listed.ok) {
        console.error("[restart-worker] List machines failed", listed.status, listed.message)
        return NextResponse.json(
          {
            error: "Could not list Fly machines",
            detail: `${listed.status} ${listed.message.slice(0, 200)}`,
          },
          { status: 502 }
        )
      }

      machineIds = listed.machines.map((m) => m.id).filter(Boolean)

      if (!machineIds.length) {
        return NextResponse.json(
          { error: "No machines found for app", appName },
          { status: 404 }
        )
      }
    }

    const results: {
      id: string
      ok: boolean
      status?: number
      error?: string
      step?: string
    }[] = []

    for (const machineId of machineIds) {
      const base = `${MACHINES_API}/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}`

      const stopRes = await fetch(`${base}/stop`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      })

      if (!stopRes.ok) {
        const text = await stopRes.text()
        results.push({
          id: machineId,
          ok: false,
          step: "stop",
          status: stopRes.status,
          error: text.slice(0, 500),
        })
        console.error("[restart-worker] Stop failed", machineId, stopRes.status, text)
        continue
      }

      await new Promise((r) => setTimeout(r, 2500))

      const startRes = await fetch(`${base}/start`, {
        method: "POST",
        headers,
      })

      if (!startRes.ok) {
        const text = await startRes.text()
        results.push({
          id: machineId,
          ok: false,
          step: "start",
          status: startRes.status,
          error: text.slice(0, 500),
        })
        console.error("[restart-worker] Start failed", machineId, startRes.status, text)
      } else {
        results.push({ id: machineId, ok: true, status: startRes.status })
      }
    }

    const allOk = results.every((r) => r.ok)
    if (!allOk) {
      return NextResponse.json(
        { success: false, appName, results },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      appName,
      restarted: machineIds.length,
      results,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[restart-worker]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

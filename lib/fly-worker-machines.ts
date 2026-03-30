export const MACHINES_API = "https://api.machines.dev/v1"

export type FlyMachineSummary = {
  id: string
  name?: string
  state: string
  region?: string
}

export function getWorkerFlyAppName(): string {
  return process.env.FLY_WORKER_APP_NAME?.trim() || "oruba-coin-worker"
}

export function getWorkerFlyMachineIdFilter(): string | undefined {
  const id = process.env.FLY_WORKER_MACHINE_ID?.trim()
  return id || undefined
}

function parseMachinesResponse(json: unknown): FlyMachineSummary[] {
  const rows = Array.isArray(json) ? json : (json as { machines?: unknown })?.machines ?? []
  if (!Array.isArray(rows)) return []
  const out: FlyMachineSummary[] = []
  for (const m of rows) {
    const row = m as Record<string, unknown>
    const id = typeof row.id === "string" ? row.id : ""
    if (!id) continue
    const state =
      typeof row.state === "string"
        ? row.state
        : typeof row.status === "string"
          ? row.status
          : "unknown"
    const rec: FlyMachineSummary = { id, state }
    if (typeof row.name === "string") rec.name = row.name
    if (typeof row.region === "string") rec.region = row.region
    out.push(rec)
  }
  return out
}

export async function listFlyMachinesForApp(
  token: string,
  appName: string
): Promise<
  { ok: true; machines: FlyMachineSummary[] } | { ok: false; status: number; message: string }
> {
  const res = await fetch(
    `${MACHINES_API}/apps/${encodeURIComponent(appName)}/machines`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, status: res.status, message: text.slice(0, 500) }
  }
  const json: unknown = await res.json()
  return { ok: true, machines: parseMachinesResponse(json) }
}

export type FlyMachinesAggregate =
  | "all_running"
  | "all_stopped"
  | "transitioning"
  | "partial"
  | "none"
  | "unknown"

export function summarizeFlyMachineStates(machines: FlyMachineSummary[]): FlyMachinesAggregate {
  if (machines.length === 0) return "none"
  const states = machines.map((m) => m.state.toLowerCase())
  if (states.some((s) => s === "starting" || s === "stopping")) return "transitioning"
  if (states.every((s) => s === "started")) return "all_running"
  if (states.every((s) => s === "stopped")) return "all_stopped"
  if (states.some((s) => s === "started")) return "partial"
  return "unknown"
}

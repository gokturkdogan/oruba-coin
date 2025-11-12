import webPush, { PushSubscription } from "web-push"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:orubacoin@gmail.com"

let vapidConfigured = false

function ensureConfigured() {
  if (vapidConfigured) return true
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[push] VAPID keys are missing. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.")
    return false
  }

  try {
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    vapidConfigured = true
  } catch (error) {
    console.error("[push] Failed to configure VAPID keys", error)
    return false
  }

  return true
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY ?? null
}

type NotificationPayload = {
  title: string
  body?: string
  url?: string
  icon?: string
  data?: Record<string, unknown>
}

export async function sendPushNotification(subscription: PushSubscription, payload: NotificationPayload) {
  if (!ensureConfigured()) {
    throw new Error("VAPID keys not configured")
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    icon: payload.icon,
    data: payload.data,
  })

  return webPush.sendNotification(subscription, notificationPayload, {
    TTL: 60,
  })
}

export async function sendBulkNotifications(
  subscriptions: PushSubscription[],
  payload: NotificationPayload
) {
  if (!ensureConfigured()) {
    throw new Error("VAPID keys not configured")
  }

  const results = await Promise.allSettled(
    subscriptions.map((subscription) => sendPushNotification(subscription, payload))
  )

  const failed: PushSubscription[] = []

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const reason = result.reason
      if (reason?.statusCode === 410 || reason?.statusCode === 404) {
        failed.push(subscriptions[index])
      } else {
        console.error("[push] Failed to send notification", reason)
      }
    }
  })

  return { failed }
}

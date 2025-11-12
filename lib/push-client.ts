const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")

  const decodeBase64 = () => {
    if (typeof window !== "undefined" && typeof window.atob === "function") {
      return window.atob(base64)
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(base64, "base64").toString("binary")
    }
    throw new Error("Base64 decoding not supported in this environment")
  }

  const rawData = decodeBase64()

  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function sendSubscriptionToServer(subscription: PushSubscription) {
  try {
    const res = await fetch("/api/push-subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subscription }),
    })

    if (!res.ok) {
      console.error("[push] Failed to register subscription", await res.text())
    }
  } catch (error) {
    console.error("[push] Subscription network error", error)
  }
}

export async function registerPushSubscription() {
  if (typeof window === "undefined") return
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[push] Push notifications not supported in this browser")
    return
  }

  if (!VAPID_PUBLIC_KEY) {
    console.warn("[push] Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY env")
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready

    const existingSubscription = await registration.pushManager.getSubscription()
    if (existingSubscription) {
      await sendSubscriptionToServer(existingSubscription)
      return existingSubscription
    }

    if (Notification.permission !== "granted") {
      return null
    }

    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })

    await sendSubscriptionToServer(newSubscription)
    return newSubscription
  } catch (error) {
    console.error("[push] Failed to register push subscription", error)
    return null
  }
}

export async function requestPushPermission() {
  if (typeof window === "undefined") return "denied"
  if (!("Notification" in window)) {
    console.warn("[push] Notification API not available")
    return "denied"
  }

  const current = Notification.permission
  if (current === "granted") {
    await registerPushSubscription()
    return current
  }

  if (current === "denied") {
    console.warn("[push] Notifications already denied")
    return current
  }

  const permission = await Notification.requestPermission()
  if (permission === "granted") {
    await registerPushSubscription()
  }
  return permission
}

export async function unsubscribePushSubscription() {
  if (typeof window === "undefined") return
  if (!("serviceWorker" in navigator)) return

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return

    await subscription.unsubscribe()
    await fetch("/api/push-subscriptions", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })
  } catch (error) {
    console.error("[push] Failed to unsubscribe", error)
  }
}

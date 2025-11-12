const CACHE_NAME = "oruba-static-v1"
const PRECACHE_URLS = ["/"]
const DEFAULT_ICON = "/icons/icon-192x192.png"
const DEFAULT_URL = "/"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => console.error("SW install cache error", error))
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .catch((error) => console.error("SW activate cleanup error", error))
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET" || request.url.startsWith("chrome-extension")) {
    return
  }

  const requestUrl = new URL(request.url)

  const isSameOrigin = requestUrl.origin === self.location.origin
  const isApiRequest = requestUrl.pathname.startsWith("/api/")
  const acceptsJson = request.headers.get("accept")?.includes("application/json")

  if (!isSameOrigin || isApiRequest || acceptsJson) {
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached
      }
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response
          }

          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache).catch(() => {
              // ignore cache put errors
            })
          })

          return response
        })
        .catch(() => cached)
    })
  )
})

self.addEventListener("push", (event) => {
  try {
    const data = event.data ? event.data.json() : {}

    const title = data.title || "Oruba Coin"
    const options = {
      body: data.body || "Güncel piyasa gelişmelerini kaçırmayın",
      icon: data.icon || DEFAULT_ICON,
      badge: data.badge || DEFAULT_ICON,
      data: {
        url: data.url || DEFAULT_URL,
        ...data.data,
      },
    }

    event.waitUntil(self.registration.showNotification(title, options))
  } catch (error) {
    console.error("[push] Failed to display notification", error)
  }
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || DEFAULT_URL

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
      return undefined
    })
  )
})

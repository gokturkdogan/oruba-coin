// Cache name'i version ile güncelle (her deploy'da cache temizlensin)
const CACHE_NAME = "oruba-static-v2"
const PRECACHE_URLS = ["/"]
const DEFAULT_ICON = "/icons/icon-192x192.png"
const DEFAULT_URL = "/"

self.addEventListener("install", (event) => {
  // Development modunda cache'i atla, production'da cache'le
  const isDevelopment = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1"
  
  if (isDevelopment) {
    // Development: Cache'i atla, hemen aktif et
    self.skipWaiting()
    return
  }
  
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => console.error("SW install cache error", error))
      .then(() => self.skipWaiting()) // Yeni service worker'ı hemen aktif et
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Eski cache'leri temizle
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key !== CACHE_NAME)
              .map((key) => caches.delete(key))
          )
        )
        .catch((error) => console.error("SW activate cleanup error", error)),
      // Tüm client'ları kontrol et ve yeni service worker'ı aktif et
      self.clients.claim()
    ])
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET" || request.url.startsWith("chrome-extension")) {
    return
  }

  const requestUrl = new URL(request.url)
  const isDevelopment = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1"

  const isSameOrigin = requestUrl.origin === self.location.origin
  const isApiRequest = requestUrl.pathname.startsWith("/api/")
  const acceptsJson = request.headers.get("accept")?.includes("application/json")
  const isNextData = requestUrl.pathname.startsWith("/_next/")

  // Development modunda hiçbir şeyi cache'leme
  if (isDevelopment) {
    return
  }

  // API istekleri ve Next.js data istekleri cache'lenmesin
  if (!isSameOrigin || isApiRequest || acceptsJson || isNextData) {
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

    const title = data.title || "Yeni bildirimin var"
    const options = {
      body: data.body || "Son gelişmeleri görmek için uygulamayı açın.",
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

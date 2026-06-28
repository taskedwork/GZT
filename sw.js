/**
 * Service Worker - PWA 离线缓存
 * 缓存策略：
 * - index.html: 网络优先，失败回退缓存
 * - 静态资源: 缓存优先
 * - API/WebSocket: 不缓存，直连后端
 */

const CACHE_NAME = 'sdd-pwa-v19'
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
]

// 安装：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  )
  self.skipWaiting()
})

// 接收客户端消息
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// 激活：清理旧缓存并通知客户端刷新
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim()).then(() => {
      // 通知所有客户端有新版本
      return self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'SW_UPDATED' }))
      })
    })
  )
})

// 请求拦截
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API 和 WebSocket 请求不缓存，直连后端
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) {
    return
  }

  // 本地后端请求不缓存
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return
  }

  // HTML 页面：网络优先，失败回退缓存
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy))
          return res
        })
        .catch(() => caches.match('./index.html'))
    )
    return
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((res) => {
        const copy = res.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        return res
      })
    })
  )
})

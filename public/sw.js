// Service Worker for Push Notifications
const CACHE_NAME = 'creativeops-v1'
const urlsToCache = [
  '/',
  '/offline.html'
]

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  )
})

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
      })
  )
})

// Push event
self.addEventListener('push', (event) => {
  console.log('Push event received:', event)
  
  let notificationData = {
    title: 'CreativeOps Notification',
    body: 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/badge-icon.png',
    tag: 'default',
    data: {}
  }

  if (event.data) {
    try {
      const data = event.data.json()
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || data.message || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || data.id || notificationData.tag,
        data: {
          url: data.url || data.action_url,
          notificationId: data.id,
          ...data
        },
        actions: data.actions || [
          {
            action: 'view',
            title: 'View',
            icon: '/icons/view.png'
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: '/icons/dismiss.png'
          }
        ],
        requireInteraction: data.priority === 'urgent' || data.priority === 'high',
        silent: data.priority === 'low'
      }
    } catch (error) {
      console.error('Error parsing push data:', error)
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event)
  
  event.notification.close()

  const action = event.action
  const data = event.notification.data

  if (action === 'dismiss') {
    // Just close the notification
    return
  }

  // Handle view action or notification click
  const urlToOpen = data.url || '/'
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }
        
        // If no existing window/tab, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )

  // Mark notification as read if we have the notification ID
  if (data.notificationId) {
    event.waitUntil(
      fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notificationId: data.notificationId
        })
      }).catch(error => {
        console.error('Error marking notification as read:', error)
      })
    )
  }
})

// Background sync event (for offline actions)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle background sync tasks
      console.log('Background sync triggered')
    )
  }
})

// Message event (for communication with main thread)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag)
  
  // Track notification dismissal analytics
  const data = event.notification.data
  if (data.notificationId) {
    event.waitUntil(
      fetch('/api/notifications/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notificationId: data.notificationId,
          action: 'dismissed'
        })
      }).catch(error => {
        console.error('Error tracking notification dismissal:', error)
      })
    )
  }
})
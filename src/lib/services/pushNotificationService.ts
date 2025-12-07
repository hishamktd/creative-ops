import { notificationService } from './notificationService'
import type { Notification } from '@/types/notifications'

export class PushNotificationService {
  private vapidPublicKey: string
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null

  constructor() {
    this.vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  }

  /**
   * Initialize push notifications
   */
  async initialize(): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('Push notifications are not supported in this browser')
      return false
    }

    try {
      // Register service worker
      this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js')
      console.log('Service Worker registered successfully')

      // Check if already subscribed
      const existingSubscription = await this.serviceWorkerRegistration.pushManager.getSubscription()
      if (existingSubscription) {
        console.log('Already subscribed to push notifications')
        return true
      }

      return true
    } catch (error) {
      console.error('Error initializing push notifications:', error)
      return false
    }
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return (
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    )
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    return Notification.permission
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return false
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscription | null> {
    if (!this.serviceWorkerRegistration) {
      await this.initialize()
    }

    if (!this.serviceWorkerRegistration) {
      throw new Error('Service Worker not registered')
    }

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      })

      // Register subscription with backend
      await notificationService.registerPushSubscription(subscription)
      
      console.log('Successfully subscribed to push notifications')
      return subscription
    } catch (error) {
      console.error('Error subscribing to push notifications:', error)
      return null
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.serviceWorkerRegistration) {
      return false
    }

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        await notificationService.unregisterPushSubscription(subscription.endpoint)
        console.log('Successfully unsubscribed from push notifications')
      }
      return true
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error)
      return false
    }
  }

  /**
   * Get current subscription
   */
  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.serviceWorkerRegistration) {
      await this.initialize()
    }

    if (!this.serviceWorkerRegistration) {
      return null
    }

    try {
      return await this.serviceWorkerRegistration.pushManager.getSubscription()
    } catch (error) {
      console.error('Error getting push subscription:', error)
      return null
    }
  }

  /**
   * Show local notification (fallback for when push is not available)
   */
  async showLocalNotification(notification: Notification): Promise<boolean> {
    if (Notification.permission !== 'granted') {
      return false
    }

    try {
      const notif = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/badge-icon.png',
        tag: notification.id,
        data: {
          url: notification.action_url,
          notificationId: notification.id
        },
        requireInteraction: notification.priority === 'urgent' || notification.priority === 'high',
        silent: notification.priority === 'low'
      })

      // Handle notification click
      notif.onclick = () => {
        if (notification.action_url) {
          window.open(notification.action_url, '_blank')
        }
        notif.close()
        
        // Mark as read
        notificationService.markAsRead(notification.id)
      }

      // Auto-close after delay (except for urgent notifications)
      if (notification.priority !== 'urgent') {
        setTimeout(() => {
          notif.close()
        }, 5000)
      }

      return true
    } catch (error) {
      console.error('Error showing local notification:', error)
      return false
    }
  }

  /**
   * Test push notification
   */
  async testNotification(): Promise<boolean> {
    try {
      const testNotification: Notification = {
        id: 'test-' + Date.now(),
        user_id: 'current-user',
        title: 'Test Notification',
        message: 'This is a test push notification from CreativeOps',
        type: 'info',
        priority: 'medium',
        channels: ['push'],
        read: false,
        metadata: {},
        created_at: new Date().toISOString()
      }

      return await this.showLocalNotification(testNotification)
    } catch (error) {
      console.error('Error sending test notification:', error)
      return false
    }
  }

  /**
   * Setup notification event listeners
   */
  setupEventListeners(): void {
    if (!this.serviceWorkerRegistration) {
      return
    }

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICKED') {
        // Handle notification click events
        console.log('Notification clicked:', event.data)
      }
    })

    // Listen for service worker updates
    this.serviceWorkerRegistration.addEventListener('updatefound', () => {
      console.log('Service Worker update found')
    })
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  /**
   * Check if notifications are enabled for the current origin
   */
  async checkNotificationSupport(): Promise<{
    supported: boolean
    permission: NotificationPermission
    subscribed: boolean
  }> {
    const supported = this.isSupported()
    const permission = this.getPermissionStatus()
    
    let subscribed = false
    if (supported && permission === 'granted') {
      const subscription = await this.getSubscription()
      subscribed = !!subscription
    }

    return {
      supported,
      permission,
      subscribed
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    totalSent: number
    totalClicked: number
    clickRate: number
  }> {
    // This would typically come from your analytics service
    // For now, return mock data
    return {
      totalSent: 0,
      totalClicked: 0,
      clickRate: 0
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService()
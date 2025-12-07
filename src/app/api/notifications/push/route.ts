import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import webpush from 'web-push'

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'notifications@creativeops.com'),
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
)

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationIds, userIds, payload } = body

    if (!notificationIds && !userIds) {
      return NextResponse.json({ error: 'Either notificationIds or userIds must be provided' }, { status: 400 })
    }

    let targetUserIds: string[] = []

    if (notificationIds) {
      // Get user IDs from notification IDs
      const { data: notifications, error: notificationsError } = await supabase
        .from('notifications')
        .select('user_id')
        .in('id', notificationIds)

      if (notificationsError) {
        console.error('Error fetching notifications:', notificationsError)
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
      }

      targetUserIds = notifications.map(n => n.user_id)
    } else {
      targetUserIds = userIds
    }

    // Get push subscriptions for target users
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', targetUserIds)
      .eq('is_active', true)

    if (subscriptionsError) {
      console.error('Error fetching push subscriptions:', subscriptionsError)
      return NextResponse.json({ error: 'Failed to fetch push subscriptions' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No active push subscriptions found',
        results: []
      })
    }

    // Get notification details if we have notification IDs
    let notificationData = payload
    if (notificationIds && notificationIds.length > 0) {
      const { data: notifications } = await supabase
        .from('notifications')
        .select(`
          *,
          asset:assets(id, name, file_type),
          project:projects(id, name)
        `)
        .in('id', notificationIds)

      if (notifications && notifications.length > 0) {
        const notification = notifications[0] // Use first notification for payload
        notificationData = {
          title: notification.title,
          body: notification.message,
          icon: '/favicon.ico',
          badge: '/badge-icon.png',
          tag: notification.id,
          data: {
            url: notification.action_url,
            notificationId: notification.id,
            type: notification.type,
            priority: notification.priority
          },
          actions: [
            {
              action: 'view',
              title: 'View'
            },
            {
              action: 'dismiss',
              title: 'Dismiss'
            }
          ],
          requireInteraction: notification.priority === 'urgent' || notification.priority === 'high',
          silent: notification.priority === 'low'
        }
      }
    }

    const results = []

    // Send push notifications
    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key
          }
        }

        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(notificationData),
          {
            TTL: 24 * 60 * 60, // 24 hours
            urgency: getPushUrgency(notificationData.data?.priority || 'medium')
          }
        )

        results.push({
          userId: subscription.user_id,
          endpoint: subscription.endpoint,
          success: true
        })

        // Update delivery status
        if (notificationIds) {
          await supabase
            .from('notification_deliveries')
            .update({ 
              status: 'sent',
              delivered_at: new Date().toISOString()
            })
            .in('notification_id', notificationIds)
            .eq('channel', 'push')
        }

      } catch (error) {
        console.error('Error sending push notification:', error)
        
        results.push({
          userId: subscription.user_id,
          endpoint: subscription.endpoint,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })

        // Handle subscription errors (expired, invalid, etc.)
        if (error instanceof Error && (
          error.message.includes('410') || // Gone
          error.message.includes('invalid') ||
          error.message.includes('expired')
        )) {
          // Deactivate invalid subscription
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('id', subscription.id)
        }

        // Update delivery status as failed
        if (notificationIds) {
          await supabase
            .from('notification_deliveries')
            .update({ 
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error'
            })
            .in('notification_id', notificationIds)
            .eq('channel', 'push')
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length
    })

  } catch (error) {
    console.error('Error sending push notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Test endpoint for push notifications
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (subscriptionsError) {
      console.error('Error fetching push subscriptions:', subscriptionsError)
      return NextResponse.json({ error: 'Failed to fetch push subscriptions' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ 
        error: 'No active push subscriptions found for user' 
      }, { status: 404 })
    }

    // Send test notification to all user's subscriptions
    const testPayload = {
      title: 'CreativeOps Test Notification',
      body: 'This is a test push notification. If you received this, push notifications are working correctly!',
      icon: '/favicon.ico',
      badge: '/badge-icon.png',
      tag: 'test-' + Date.now(),
      data: {
        url: '/notifications',
        type: 'test'
      },
      actions: [
        {
          action: 'view',
          title: 'View Notifications'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    }

    const results = []

    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key
          }
        }

        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(testPayload)
        )

        results.push({
          endpoint: subscription.endpoint,
          success: true
        })

      } catch (error) {
        console.error('Error sending test push notification:', error)
        
        results.push({
          endpoint: subscription.endpoint,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Test notifications sent',
      results
    })

  } catch (error) {
    console.error('Error sending test push notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get push urgency level based on notification priority
 */
function getPushUrgency(priority: string): 'very-low' | 'low' | 'normal' | 'high' {
  switch (priority) {
    case 'urgent':
      return 'high'
    case 'high':
      return 'normal'
    case 'medium':
      return 'normal'
    case 'low':
      return 'low'
    default:
      return 'normal'
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emailService } from '@/lib/services/emailService'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationIds, type = 'immediate' } = body

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json({ error: 'Invalid notification IDs' }, { status: 400 })
    }

    // Get notifications with user details
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select(`
        *,
        user:users!notifications_user_id_fkey(email, full_name),
        asset:assets(id, name, file_type),
        project:projects(id, name),
        comment:comments(id, content)
      `)
      .in('id', notificationIds)

    if (notificationsError) {
      console.error('Error fetching notifications:', notificationsError)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    if (!notifications || notifications.length === 0) {
      return NextResponse.json({ error: 'No notifications found' }, { status: 404 })
    }

    // Get user preferences for each notification
    const userIds = [...new Set(notifications.map(n => n.user_id))]
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('*')
      .in('user_id', userIds)

    const preferencesMap = preferences?.reduce((acc, pref) => {
      if (!acc[pref.user_id]) acc[pref.user_id] = {}
      acc[pref.user_id][pref.event_type] = pref
      return acc
    }, {} as Record<string, Record<string, any>>) || {}

    const results = []

    if (type === 'digest') {
      // Group notifications by user for digest emails
      const notificationsByUser = notifications.reduce((acc, notification) => {
        if (!acc[notification.user_id]) acc[notification.user_id] = []
        acc[notification.user_id].push(notification)
        return acc
      }, {} as Record<string, any[]>)

      for (const [userId, userNotifications] of Object.entries(notificationsByUser)) {
        const userEmail = userNotifications[0].user?.email
        if (!userEmail) continue

        const success = await emailService.sendDigestEmail(
          userEmail,
          userNotifications,
          body.frequency || 'daily'
        )

        results.push({
          userId,
          email: userEmail,
          notificationCount: userNotifications.length,
          success
        })

        // Update delivery status
        if (success) {
          await supabase
            .from('notification_deliveries')
            .update({ 
              status: 'sent',
              delivered_at: new Date().toISOString()
            })
            .in('notification_id', userNotifications.map(n => n.id))
            .eq('channel', 'email')
        }
      }
    } else {
      // Send individual notification emails
      for (const notification of notifications) {
        const userEmail = notification.user?.email
        if (!userEmail) continue

        // Get user preferences for this event type
        const eventType = this.getEventTypeFromNotification(notification)
        const userPrefs = preferencesMap[notification.user_id]?.[eventType]

        const success = await emailService.sendNotificationEmail(
          userEmail,
          notification,
          userPrefs
        )

        results.push({
          notificationId: notification.id,
          userId: notification.user_id,
          email: userEmail,
          success
        })

        // Update delivery status
        await supabase
          .from('notification_deliveries')
          .update({ 
            status: success ? 'sent' : 'failed',
            delivered_at: success ? new Date().toISOString() : null,
            error_message: success ? null : 'Email delivery failed'
          })
          .eq('notification_id', notification.id)
          .eq('channel', 'email')
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length
    })

  } catch (error) {
    console.error('Error sending email notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to determine event type from notification
function getEventTypeFromNotification(notification: any): string {
  // This would need to be enhanced based on your notification structure
  // For now, we'll use some heuristics based on the notification content
  
  if (notification.asset_id) {
    if (notification.title.includes('uploaded')) return 'asset_uploaded'
    if (notification.title.includes('updated')) return 'asset_updated'
    if (notification.title.includes('deleted')) return 'asset_deleted'
    if (notification.title.includes('comment')) return 'asset_commented'
    if (notification.title.includes('approved')) return 'asset_approved'
    if (notification.title.includes('rejected')) return 'asset_rejected'
  }
  
  if (notification.comment_id) {
    return 'asset_commented'
  }
  
  // Default fallback
  return 'asset_updated'
}
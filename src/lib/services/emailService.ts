import { Resend } from 'resend'
import type { Notification, ActivityEventType } from '@/types/notifications'

// Email service using Resend (can be swapped for other providers)
export class EmailService {
  private resend: Resend | null = null

  constructor() {
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      this.resend = new Resend(apiKey)
    } else {
      console.warn('RESEND_API_KEY not found. Email notifications will be disabled.')
    }
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(
    to: string,
    notification: Notification,
    userPreferences?: {
      frequency: string
      quietHoursStart?: string
      quietHoursEnd?: string
      timezone: string
    }
  ): Promise<boolean> {
    if (!this.resend) {
      console.warn('Email service not configured')
      return false
    }

    // Check if we should send email based on user preferences
    if (!this.shouldSendEmail(notification, userPreferences)) {
      return false
    }

    try {
      const emailContent = this.generateEmailContent(notification)
      
      const { data, error } = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'notifications@creativeops.com',
        to,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      })

      if (error) {
        console.error('Error sending email:', error)
        return false
      }

      console.log('Email sent successfully:', data?.id)
      return true
    } catch (error) {
      console.error('Error sending notification email:', error)
      return false
    }
  }

  /**
   * Send digest email with multiple notifications
   */
  async sendDigestEmail(
    to: string,
    notifications: Notification[],
    frequency: 'hourly' | 'daily' | 'weekly'
  ): Promise<boolean> {
    if (!this.resend || notifications.length === 0) {
      return false
    }

    try {
      const emailContent = this.generateDigestContent(notifications, frequency)
      
      const { data, error } = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'notifications@creativeops.com',
        to,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      })

      if (error) {
        console.error('Error sending digest email:', error)
        return false
      }

      console.log('Digest email sent successfully:', data?.id)
      return true
    } catch (error) {
      console.error('Error sending digest email:', error)
      return false
    }
  }

  /**
   * Check if email should be sent based on user preferences
   */
  private shouldSendEmail(
    notification: Notification,
    preferences?: {
      frequency: string
      quietHoursStart?: string
      quietHoursEnd?: string
      timezone: string
    }
  ): boolean {
    // Always send urgent notifications immediately
    if (notification.priority === 'urgent') {
      return true
    }

    // Check if email channel is enabled
    if (!notification.channels.includes('email')) {
      return false
    }

    // If no preferences, send immediately
    if (!preferences) {
      return true
    }

    // Check frequency preference
    if (preferences.frequency !== 'immediate') {
      return false // Will be handled by digest
    }

    // Check quiet hours
    if (preferences.quietHoursStart && preferences.quietHoursEnd) {
      const now = new Date()
      const userTime = new Intl.DateTimeFormat('en-US', {
        timeZone: preferences.timezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      }).format(now)

      const currentTime = userTime.replace(':', '')
      const quietStart = preferences.quietHoursStart.replace(':', '')
      const quietEnd = preferences.quietHoursEnd.replace(':', '')

      // Check if current time is within quiet hours
      if (quietStart <= quietEnd) {
        // Same day quiet hours
        if (currentTime >= quietStart && currentTime <= quietEnd) {
          return false
        }
      } else {
        // Overnight quiet hours
        if (currentTime >= quietStart || currentTime <= quietEnd) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Generate email content for a single notification
   */
  private generateEmailContent(notification: Notification): {
    subject: string
    html: string
    text: string
  } {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.creativeops.com'
    const actionUrl = notification.action_url ? `${baseUrl}${notification.action_url}` : baseUrl

    const subject = `CreativeOps: ${notification.title}`
    
    const text = `
${notification.title}

${notification.message}

${notification.action_url ? `View: ${actionUrl}` : ''}

---
CreativeOps Team
${baseUrl}
    `.trim()

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notification.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6366f1; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .priority-${notification.priority} { border-left: 4px solid ${this.getPriorityColor(notification.priority)}; padding-left: 16px; }
    .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">CreativeOps</h1>
    </div>
    <div class="content">
      <div class="priority-${notification.priority}">
        <h2 style="margin-top: 0; color: #1f2937;">${notification.title}</h2>
        <p style="font-size: 16px; margin: 16px 0;">${notification.message}</p>
        
        ${notification.action_url ? `
          <a href="${actionUrl}" class="button">View Details</a>
        ` : ''}
        
        ${this.renderNotificationMetadata(notification)}
      </div>
    </div>
    <div class="footer">
      <p>This notification was sent by CreativeOps</p>
      <p><a href="${baseUrl}/settings/notifications">Manage notification preferences</a></p>
    </div>
  </div>
</body>
</html>
    `.trim()

    return { subject, html, text }
  }

  /**
   * Generate digest email content
   */
  private generateDigestContent(
    notifications: Notification[],
    frequency: 'hourly' | 'daily' | 'weekly'
  ): {
    subject: string
    html: string
    text: string
  } {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.creativeops.com'
    const count = notifications.length
    const subject = `CreativeOps: ${count} new notification${count > 1 ? 's' : ''} (${frequency} digest)`

    // Group notifications by project
    const byProject = notifications.reduce((acc, notification) => {
      const projectName = notification.project?.name || 'General'
      if (!acc[projectName]) acc[projectName] = []
      acc[projectName].push(notification)
      return acc
    }, {} as Record<string, Notification[]>)

    const text = `
CreativeOps ${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Digest

You have ${count} new notification${count > 1 ? 's' : ''}:

${Object.entries(byProject).map(([project, notifications]) => `
${project}:
${notifications.map(n => `• ${n.title}: ${n.message}`).join('\n')}
`).join('\n')}

View all notifications: ${baseUrl}/notifications

---
CreativeOps Team
${baseUrl}
    `.trim()

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6366f1; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .project-group { margin: 20px 0; padding: 16px; background: white; border-radius: 6px; border-left: 4px solid #6366f1; }
    .notification-item { margin: 12px 0; padding: 12px; background: #f3f4f6; border-radius: 4px; }
    .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
    .priority-high { border-left-color: #ef4444; }
    .priority-urgent { border-left-color: #dc2626; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">CreativeOps</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Digest</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0; color: #1f2937;">You have ${count} new notification${count > 1 ? 's' : ''}</h2>
      
      ${Object.entries(byProject).map(([project, notifications]) => `
        <div class="project-group">
          <h3 style="margin-top: 0; color: #374151;">${project}</h3>
          ${notifications.map(notification => `
            <div class="notification-item priority-${notification.priority}">
              <strong>${notification.title}</strong>
              <p style="margin: 4px 0 0 0; color: #6b7280;">${notification.message}</p>
              ${notification.action_url ? `<a href="${baseUrl}${notification.action_url}" style="color: #6366f1; text-decoration: none;">View →</a>` : ''}
            </div>
          `).join('')}
        </div>
      `).join('')}
      
      <a href="${baseUrl}/notifications" class="button">View All Notifications</a>
    </div>
    <div class="footer">
      <p>This digest was sent by CreativeOps</p>
      <p><a href="${baseUrl}/settings/notifications">Manage notification preferences</a></p>
    </div>
  </div>
</body>
</html>
    `.trim()

    return { subject, html, text }
  }

  /**
   * Get priority color for styling
   */
  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent': return '#dc2626'
      case 'high': return '#ef4444'
      case 'medium': return '#f59e0b'
      case 'low': return '#10b981'
      default: return '#6b7280'
    }
  }

  /**
   * Render notification metadata in email
   */
  private renderNotificationMetadata(notification: Notification): string {
    if (!notification.metadata || Object.keys(notification.metadata).length === 0) {
      return ''
    }

    const metadata = notification.metadata
    let content = '<div style="margin-top: 16px; padding: 12px; background: #e5e7eb; border-radius: 4px;">'
    
    if (metadata.file_type) {
      content += `<p style="margin: 4px 0;"><strong>File Type:</strong> ${metadata.file_type.toUpperCase()}</p>`
    }
    
    if (metadata.file_size) {
      const size = this.formatFileSize(metadata.file_size)
      content += `<p style="margin: 4px 0;"><strong>File Size:</strong> ${size}</p>`
    }
    
    if (metadata.comment_preview) {
      content += `<p style="margin: 4px 0;"><strong>Comment:</strong> "${metadata.comment_preview}${metadata.comment_preview.length >= 100 ? '...' : ''}"</p>`
    }
    
    content += '</div>'
    return content
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// Export singleton instance
export const emailService = new EmailService()
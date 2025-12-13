import { analyticsService } from './analyticsService'
import { createClient } from '@/lib/supabase/client'

interface HealthCheck {
  name: string
  status: 'healthy' | 'warning' | 'critical'
  value: number
  unit?: string
  message?: string
  thresholds: {
    warning: number
    critical: number
  }
}

interface SystemMetrics {
  uptime: number
  responseTime: number
  errorRate: number
  storageUsage: number
  databaseConnections: number
  memoryUsage: number
  cpuUsage: number
}

export class SystemHealthMonitoring {
  private supabase = createClient()
  private checkInterval: NodeJS.Timeout | null = null
  private isMonitoring = false

  // Health check thresholds
  private thresholds = {
    responseTime: { warning: 1000, critical: 3000 }, // ms
    errorRate: { warning: 5, critical: 10 }, // percentage
    storageUsage: { warning: 80, critical: 95 }, // percentage
    databaseConnections: { warning: 80, critical: 95 }, // percentage of max
    memoryUsage: { warning: 80, critical: 90 }, // percentage
    cpuUsage: { warning: 70, critical: 85 }, // percentage
    uptime: { warning: 99, critical: 95 } // percentage
  }

  async startMonitoring(intervalMs: number = 60000) {
    if (this.isMonitoring) {
      console.log('Health monitoring already running')
      return
    }

    this.isMonitoring = true
    console.log('Starting system health monitoring...')

    // Run initial check
    await this.performHealthCheck()

    // Set up periodic checks
    this.checkInterval = setInterval(async () => {
      try {
        await this.performHealthCheck()
      } catch (error) {
        console.error('Health check failed:', error)
      }
    }, intervalMs)
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.isMonitoring = false
    console.log('System health monitoring stopped')
  }

  async performHealthCheck(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = []

    try {
      // Get system metrics
      const metrics = await this.collectSystemMetrics()

      // Check response time
      checks.push(this.checkResponseTime(metrics.responseTime))

      // Check error rate
      checks.push(this.checkErrorRate(metrics.errorRate))

      // Check storage usage
      checks.push(this.checkStorageUsage(metrics.storageUsage))

      // Check database health
      checks.push(this.checkDatabaseHealth(metrics.databaseConnections))

      // Check uptime
      checks.push(this.checkUptime(metrics.uptime))

      // Check memory usage (if available)
      if (metrics.memoryUsage !== undefined) {
        checks.push(this.checkMemoryUsage(metrics.memoryUsage))
      }

      // Check CPU usage (if available)
      if (metrics.cpuUsage !== undefined) {
        checks.push(this.checkCpuUsage(metrics.cpuUsage))
      }

      // Record all health metrics
      await this.recordHealthMetrics(checks)

      // Check for alerts
      await this.processAlerts(checks)

      return checks
    } catch (error) {
      console.error('Error performing health check:', error)
      
      // Record critical system error
      const errorCheck: HealthCheck = {
        name: 'system_error',
        status: 'critical',
        value: 1,
        message: error instanceof Error ? error.message : 'Unknown system error',
        thresholds: { warning: 0, critical: 1 }
      }

      await this.recordHealthMetrics([errorCheck])
      return [errorCheck]
    }
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const startTime = Date.now()

    // Test database response time
    try {
      await this.supabase.from('projects').select('id').limit(1)
    } catch (error) {
      console.error('Database health check failed:', error)
    }

    const responseTime = Date.now() - startTime

    // Get error rate from recent performance analytics
    const errorRate = await this.calculateErrorRate()

    // Get storage usage
    const storageUsage = await this.calculateStorageUsage()

    // Get database connection info (simplified)
    const databaseConnections = await this.checkDatabaseConnections()

    // Calculate uptime (simplified - in production this would come from system metrics)
    const uptime = await this.calculateUptime()

    return {
      uptime,
      responseTime,
      errorRate,
      storageUsage,
      databaseConnections,
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: this.getCpuUsage()
    }
  }

  private async calculateErrorRate(): Promise<number> {
    try {
      // Get recent performance metrics to calculate error rate
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

      const { data: metrics } = await this.supabase
        .from('performance_analytics')
        .select('context')
        .gte('recorded_at', twentyFourHoursAgo.toISOString())
        .limit(1000)

      if (!metrics || metrics.length === 0) return 0

      const totalRequests = metrics.length
      const errorRequests = metrics.filter(m => 
        m.context && (m.context.error || m.context.status >= 400)
      ).length

      return totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0
    } catch (error) {
      console.error('Error calculating error rate:', error)
      return 0
    }
  }

  private async calculateStorageUsage(): Promise<number> {
    try {
      // Get total storage usage across all projects
      const { data: storageData } = await this.supabase
        .from('storage_usage_analytics')
        .select('total_storage_bytes, quota_limit_bytes')
        .order('recorded_at', { ascending: false })
        .limit(10)

      if (!storageData || storageData.length === 0) return 0

      const totalUsed = storageData.reduce((sum, item) => sum + (item.total_storage_bytes || 0), 0)
      const totalQuota = storageData.reduce((sum, item) => sum + (item.quota_limit_bytes || 0), 0)

      return totalQuota > 0 ? (totalUsed / totalQuota) * 100 : 0
    } catch (error) {
      console.error('Error calculating storage usage:', error)
      return 0
    }
  }

  private async checkDatabaseConnections(): Promise<number> {
    try {
      // Simple database connectivity check
      const { error } = await this.supabase
        .from('projects')
        .select('id')
        .limit(1)

      // Return 0 if healthy, 100 if error (simplified)
      return error ? 100 : 10 // Assume 10% usage when healthy
    } catch (error) {
      return 100 // Critical if can't connect
    }
  }

  private async calculateUptime(): Promise<number> {
    try {
      // Get system health metrics from the last 24 hours
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

      const { data: healthData } = await this.supabase
        .from('system_health_metrics')
        .select('status, recorded_at')
        .gte('recorded_at', twentyFourHoursAgo.toISOString())
        .order('recorded_at', { ascending: true })

      if (!healthData || healthData.length === 0) return 100 // Assume healthy if no data

      const totalChecks = healthData.length
      const healthyChecks = healthData.filter(h => h.status === 'healthy').length

      return totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 100
    } catch (error) {
      console.error('Error calculating uptime:', error)
      return 95 // Conservative estimate
    }
  }

  private getMemoryUsage(): number | undefined {
    // In a browser environment, we can't get system memory usage
    // In Node.js, you would use process.memoryUsage()
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      const totalMemory = usage.heapTotal + usage.external
      const usedMemory = usage.heapUsed
      return (usedMemory / totalMemory) * 100
    }
    return undefined
  }

  private getCpuUsage(): number | undefined {
    // CPU usage would typically come from system monitoring tools
    // This is a placeholder for demonstration
    return undefined
  }

  private checkResponseTime(responseTime: number): HealthCheck {
    const thresholds = this.thresholds.responseTime
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (responseTime >= thresholds.critical) {
      status = 'critical'
    } else if (responseTime >= thresholds.warning) {
      status = 'warning'
    }

    return {
      name: 'response_time',
      status,
      value: responseTime,
      unit: 'ms',
      message: `Database response time: ${responseTime}ms`,
      thresholds
    }
  }

  private checkErrorRate(errorRate: number): HealthCheck {
    const thresholds = this.thresholds.errorRate
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (errorRate >= thresholds.critical) {
      status = 'critical'
    } else if (errorRate >= thresholds.warning) {
      status = 'warning'
    }

    return {
      name: 'error_rate',
      status,
      value: errorRate,
      unit: '%',
      message: `Error rate: ${errorRate.toFixed(2)}%`,
      thresholds
    }
  }

  private checkStorageUsage(storageUsage: number): HealthCheck {
    const thresholds = this.thresholds.storageUsage
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (storageUsage >= thresholds.critical) {
      status = 'critical'
    } else if (storageUsage >= thresholds.warning) {
      status = 'warning'
    }

    return {
      name: 'storage_health',
      status,
      value: storageUsage,
      unit: '%',
      message: `Storage usage: ${storageUsage.toFixed(1)}%`,
      thresholds
    }
  }

  private checkDatabaseHealth(connectionUsage: number): HealthCheck {
    const thresholds = this.thresholds.databaseConnections
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (connectionUsage >= thresholds.critical) {
      status = 'critical'
    } else if (connectionUsage >= thresholds.warning) {
      status = 'warning'
    }

    return {
      name: 'database_health',
      status,
      value: connectionUsage,
      unit: '%',
      message: `Database connection usage: ${connectionUsage.toFixed(1)}%`,
      thresholds
    }
  }

  private checkUptime(uptime: number): HealthCheck {
    const thresholds = this.thresholds.uptime
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (uptime <= thresholds.critical) {
      status = 'critical'
    } else if (uptime <= thresholds.warning) {
      status = 'warning'
    }

    return {
      name: 'uptime',
      status,
      value: uptime,
      unit: '%',
      message: `System uptime: ${uptime.toFixed(2)}%`,
      thresholds
    }
  }

  private checkMemoryUsage(memoryUsage: number): HealthCheck {
    const thresholds = this.thresholds.memoryUsage
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (memoryUsage >= thresholds.critical) {
      status = 'critical'
    } else if (memoryUsage >= thresholds.warning) {
      status = 'warning'
    }

    return {
      name: 'memory_usage',
      status,
      value: memoryUsage,
      unit: '%',
      message: `Memory usage: ${memoryUsage.toFixed(1)}%`,
      thresholds
    }
  }

  private checkCpuUsage(cpuUsage: number): HealthCheck {
    const thresholds = this.thresholds.cpuUsage
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (cpuUsage >= thresholds.critical) {
      status = 'critical'
    } else if (cpuUsage >= thresholds.warning) {
      status = 'warning'
    }

    return {
      name: 'cpu_usage',
      status,
      value: cpuUsage,
      unit: '%',
      message: `CPU usage: ${cpuUsage.toFixed(1)}%`,
      thresholds
    }
  }

  private async recordHealthMetrics(checks: HealthCheck[]): Promise<void> {
    try {
      const promises = checks.map(check =>
        analyticsService.recordSystemHealthMetric({
          metricName: check.name,
          value: check.value,
          unit: check.unit,
          status: check.status,
          thresholdWarning: check.thresholds.warning,
          thresholdCritical: check.thresholds.critical,
          metadata: { message: check.message }
        })
      )

      await Promise.all(promises)
    } catch (error) {
      console.error('Error recording health metrics:', error)
    }
  }

  private async processAlerts(checks: HealthCheck[]): Promise<void> {
    const criticalChecks = checks.filter(check => check.status === 'critical')
    const warningChecks = checks.filter(check => check.status === 'warning')

    if (criticalChecks.length > 0) {
      console.error('CRITICAL ALERTS:', criticalChecks.map(c => c.message).join(', '))
      // In production, send notifications (email, Slack, etc.)
      await this.sendAlertNotifications('critical', criticalChecks)
    }

    if (warningChecks.length > 0) {
      console.warn('WARNING ALERTS:', warningChecks.map(c => c.message).join(', '))
      await this.sendAlertNotifications('warning', warningChecks)
    }
  }

  private async sendAlertNotifications(severity: 'warning' | 'critical', checks: HealthCheck[]): Promise<void> {
    // Placeholder for alert notification system
    // In production, integrate with email service, Slack, PagerDuty, etc.
    
    const alertMessage = {
      severity,
      timestamp: new Date().toISOString(),
      checks: checks.map(check => ({
        name: check.name,
        status: check.status,
        value: check.value,
        unit: check.unit,
        message: check.message
      }))
    }

    console.log('Alert notification:', JSON.stringify(alertMessage, null, 2))
    
    // Example: Send to webhook, email service, etc.
    // await fetch('/api/notifications/alerts', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(alertMessage)
    // })
  }

  // Public method to get current system status
  async getSystemStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical'
    checks: HealthCheck[]
    lastCheck: string
  }> {
    const checks = await this.performHealthCheck()
    
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
    
    if (checks.some(check => check.status === 'critical')) {
      overallStatus = 'critical'
    } else if (checks.some(check => check.status === 'warning')) {
      overallStatus = 'warning'
    }

    return {
      status: overallStatus,
      checks,
      lastCheck: new Date().toISOString()
    }
  }
}

export const systemHealthMonitoring = new SystemHealthMonitoring()
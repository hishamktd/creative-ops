'use client'

import React, { useState, useEffect } from 'react'
import { Save, Bell, Mail, Smartphone, Clock, Volume2, VolumeX } from 'lucide-react'
import { notificationService } from '@/lib/services/notificationService'
import type { NotificationPreferences, ActivityEventType, NotificationChannel } from '@/types/notifications'

interface NotificationPreferencesProps {
  className?: string
}

const EVENT_TYPE_LABELS: Record<ActivityEventType, string> = {
  asset_uploaded: 'Asset Uploaded',
  asset_updated: 'Asset Updated',
  asset_deleted: 'Asset Deleted',
  asset_moved: 'Asset Moved',
  asset_shared: 'Asset Shared',
  asset_commented: 'Asset Commented',
  asset_approved: 'Asset Approved',
  asset_rejected: 'Asset Rejected',
  folder_created: 'Folder Created',
  folder_updated: 'Folder Updated',
  folder_deleted: 'Folder Deleted',
  folder_shared: 'Folder Shared',
  version_created: 'Version Created',
  version_restored: 'Version Restored',
  permission_granted: 'Permission Granted',
  permission_revoked: 'Permission Revoked',
  project_created: 'Project Created',
  project_updated: 'Project Updated',
  user_joined: 'User Joined',
  user_left: 'User Left'
}

const EVENT_TYPE_DESCRIPTIONS: Record<ActivityEventType, string> = {
  asset_uploaded: 'When new assets are uploaded to projects you\'re involved in',
  asset_updated: 'When assets are modified or their metadata changes',
  asset_deleted: 'When assets are removed from projects',
  asset_moved: 'When assets are moved between folders',
  asset_shared: 'When assets are shared with external users',
  asset_commented: 'When someone comments on assets',
  asset_approved: 'When assets are approved in workflows',
  asset_rejected: 'When assets are rejected in workflows',
  folder_created: 'When new folders are created',
  folder_updated: 'When folder properties are changed',
  folder_deleted: 'When folders are removed',
  folder_shared: 'When folders are shared with external users',
  version_created: 'When new versions of assets are uploaded',
  version_restored: 'When previous versions are restored',
  permission_granted: 'When you\'re granted access to assets or folders',
  permission_revoked: 'When your access to assets or folders is removed',
  project_created: 'When new projects are created',
  project_updated: 'When project details are modified',
  user_joined: 'When new team members join projects',
  user_left: 'When team members leave projects'
}

const CHANNEL_ICONS = {
  in_app: Bell,
  email: Mail,
  push: Smartphone
}

const FREQUENCY_OPTIONS = [
  { value: 'immediate', label: 'Immediately' },
  { value: 'hourly', label: 'Hourly digest' },
  { value: 'daily', label: 'Daily digest' },
  { value: 'weekly', label: 'Weekly digest' }
]

export function NotificationPreferences({ className = '' }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [quietHours, setQuietHours] = useState({
    enabled: false,
    start: '22:00',
    end: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })

  useEffect(() => {
    loadPreferences()
    checkPushSupport()
  }, [])

  const loadPreferences = async () => {
    try {
      setLoading(true)
      const data = await notificationService.getNotificationPreferences()
      setPreferences(data)
      
      // Extract quiet hours from first preference (they should be the same for all)
      if (data.length > 0 && data[0].quiet_hours_start) {
        setQuietHours({
          enabled: true,
          start: data[0].quiet_hours_start,
          end: data[0].quiet_hours_end || '08:00',
          timezone: data[0].timezone
        })
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkPushSupport = () => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator
    setPushSupported(supported)
    
    if (supported) {
      setPushPermission(Notification.permission)
    }
  }

  const handlePreferenceChange = (
    eventType: ActivityEventType,
    field: keyof NotificationPreferences,
    value: any
  ) => {
    setPreferences(prev => {
      const existing = prev.find(p => p.event_type === eventType)
      if (existing) {
        return prev.map(p => 
          p.event_type === eventType 
            ? { ...p, [field]: value }
            : p
        )
      } else {
        // Create new preference
        return [...prev, {
          id: `temp-${eventType}`,
          user_id: 'current-user', // This should come from auth context
          event_type: eventType,
          channels: ['in_app'],
          enabled: true,
          frequency: 'immediate',
          timezone: quietHours.timezone,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          [field]: value
        } as NotificationPreferences]
      }
    })
  }

  const handleChannelToggle = (eventType: ActivityEventType, channel: NotificationChannel) => {
    const preference = preferences.find(p => p.event_type === eventType)
    const currentChannels = preference?.channels || ['in_app']
    
    let newChannels: NotificationChannel[]
    if (currentChannels.includes(channel)) {
      newChannels = currentChannels.filter(c => c !== channel)
      // Ensure at least one channel is selected
      if (newChannels.length === 0) {
        newChannels = ['in_app']
      }
    } else {
      newChannels = [...currentChannels, channel]
    }
    
    handlePreferenceChange(eventType, 'channels', newChannels)
  }

  const handleBulkToggle = (enabled: boolean, eventTypes?: ActivityEventType[]) => {
    const typesToUpdate = eventTypes || Object.keys(EVENT_TYPE_LABELS) as ActivityEventType[]
    
    typesToUpdate.forEach(eventType => {
      handlePreferenceChange(eventType, 'enabled', enabled)
    })
  }

  const handleRequestPushPermission = async () => {
    try {
      const hasPermission = await notificationService.requestNotificationPermission()
      if (hasPermission) {
        setPushPermission('granted')
        
        // Register service worker and push subscription
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.register('/sw.js')
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          })
          
          await notificationService.registerPushSubscription(subscription)
        }
      } else {
        setPushPermission('denied')
      }
    } catch (error) {
      console.error('Error requesting push permission:', error)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      const updates = preferences.map(pref => ({
        eventType: pref.event_type,
        enabled: pref.enabled,
        channels: pref.channels,
        frequency: pref.frequency
      }))
      
      await notificationService.bulkUpdatePreferences(updates)
      
      // Show success message
      alert('Notification preferences saved successfully!')
    } catch (error) {
      console.error('Error saving preferences:', error)
      alert('Failed to save preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const getPreference = (eventType: ActivityEventType): NotificationPreferences | undefined => {
    return preferences.find(p => p.event_type === eventType)
  }

  const groupedEventTypes = {
    'Asset Activities': [
      'asset_uploaded', 'asset_updated', 'asset_deleted', 'asset_moved',
      'asset_shared', 'asset_commented', 'asset_approved', 'asset_rejected'
    ] as ActivityEventType[],
    'Folder Activities': [
      'folder_created', 'folder_updated', 'folder_deleted', 'folder_shared'
    ] as ActivityEventType[],
    'Version Control': [
      'version_created', 'version_restored'
    ] as ActivityEventType[],
    'Permissions': [
      'permission_granted', 'permission_revoked'
    ] as ActivityEventType[],
    'Project & Team': [
      'project_created', 'project_updated', 'user_joined', 'user_left'
    ] as ActivityEventType[]
  }

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-6 ${className}`}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Notification Preferences
          </h2>
          <p className="text-gray-600">
            Customize how and when you receive notifications about project activities.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Quick Actions</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleBulkToggle(true)}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              <Volume2 className="w-4 h-4 inline mr-1" />
              Enable All
            </button>
            <button
              onClick={() => handleBulkToggle(false)}
              className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              <VolumeX className="w-4 h-4 inline mr-1" />
              Disable All
            </button>
            <button
              onClick={() => handleBulkToggle(true, ['asset_commented', 'asset_approved', 'asset_rejected'])}
              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              Enable Important Only
            </button>
          </div>
        </div>

        {/* Push Notifications Setup */}
        {pushSupported && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-blue-900">Push Notifications</h3>
                <p className="text-blue-700 text-sm">
                  {pushPermission === 'granted' 
                    ? 'Push notifications are enabled for this browser'
                    : pushPermission === 'denied'
                    ? 'Push notifications are blocked. Please enable them in your browser settings.'
                    : 'Enable push notifications to receive alerts even when the app is closed'
                  }
                </p>
              </div>
              {pushPermission !== 'granted' && pushPermission !== 'denied' && (
                <button
                  onClick={handleRequestPushPermission}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Enable Push
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notification Preferences by Category */}
        <div className="space-y-8">
          {Object.entries(groupedEventTypes).map(([category, eventTypes]) => (
            <div key={category} className="bg-white border border-gray-200 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">{category}</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleBulkToggle(true, eventTypes)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Enable All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => handleBulkToggle(false, eventTypes)}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Disable All
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="divide-y divide-gray-100">
                {eventTypes.map((eventType) => {
                  const preference = getPreference(eventType)
                  const enabled = preference?.enabled ?? true
                  const channels = preference?.channels ?? ['in_app']
                  const frequency = preference?.frequency ?? 'immediate'
                  
                  return (
                    <div key={eventType} className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) => handlePreferenceChange(eventType, 'enabled', e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="ml-2 text-lg font-medium text-gray-900">
                                {EVENT_TYPE_LABELS[eventType]}
                              </span>
                            </label>
                          </div>
                          
                          <p className="text-gray-600 text-sm mb-4">
                            {EVENT_TYPE_DESCRIPTIONS[eventType]}
                          </p>
                          
                          {enabled && (
                            <div className="space-y-4">
                              {/* Channels */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Notification Channels
                                </label>
                                <div className="flex space-x-4">
                                  {(['in_app', 'email', 'push'] as NotificationChannel[]).map((channel) => {
                                    const Icon = CHANNEL_ICONS[channel]
                                    const isAvailable = channel !== 'push' || pushPermission === 'granted'
                                    const isSelected = channels.includes(channel)
                                    
                                    return (
                                      <button
                                        key={channel}
                                        onClick={() => isAvailable && handleChannelToggle(eventType, channel)}
                                        disabled={!isAvailable}
                                        className={`flex items-center space-x-2 px-3 py-2 rounded-md border transition-colors ${
                                          isSelected
                                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        } ${!isAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                      >
                                        <Icon className="w-4 h-4" />
                                        <span className="text-sm capitalize">
                                          {channel.replace('_', ' ')}
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                              
                              {/* Frequency */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Frequency
                                </label>
                                <select
                                  value={frequency}
                                  onChange={(e) => handlePreferenceChange(eventType, 'frequency', e.target.value)}
                                  className="block w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                >
                                  {FREQUENCY_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Quiet Hours */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quiet Hours</h3>
          <p className="text-gray-600 text-sm mb-4">
            Set quiet hours to pause non-urgent notifications during specific times.
          </p>
          
          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={quietHours.enabled}
                onChange={(e) => setQuietHours(prev => ({ ...prev, enabled: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-900">
                Enable quiet hours
              </span>
            </label>
            
            {quietHours.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={quietHours.start}
                    onChange={(e) => setQuietHours(prev => ({ ...prev, start: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={quietHours.end}
                    onChange={(e) => setQuietHours(prev => ({ ...prev, end: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timezone
                  </label>
                  <select
                    value={quietHours.timezone}
                    onChange={(e) => setQuietHours(prev => ({ ...prev, timezone: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
                      {Intl.DateTimeFormat().resolvedOptions().timeZone} (Local)
                    </option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end mt-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Preferences
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
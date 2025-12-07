'use client'

import React, { useState, useEffect } from 'react'
import { SecurityService, type ShareLinkType, type SecureShareLink, type ShareLinkOptions } from '../../../lib/services/security'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'

interface SecureShareModalProps {
  isOpen: boolean
  onClose: () => void
  resourceId: string
  resourceType: 'asset' | 'folder'
  resourceName: string
}

const LINK_TYPES: { value: ShareLinkType; label: string; description: string }[] = [
  { value: 'view', label: 'View Only', description: 'Recipients can view but not download' },
  { value: 'download', label: 'Download', description: 'Recipients can view and download' },
  { value: 'comment', label: 'Comment', description: 'Recipients can view and add comments' }
]

const EXPIRY_OPTIONS = [
  { value: 1, label: '1 hour' },
  { value: 24, label: '24 hours' },
  { value: 168, label: '1 week' },
  { value: 720, label: '30 days' },
  { value: 0, label: 'Custom' }
]

export function SecureShareModal({ 
  isOpen, 
  onClose, 
  resourceId, 
  resourceType, 
  resourceName 
}: SecureShareModalProps) {
  const [linkType, setLinkType] = useState<ShareLinkType>('view')
  const [expiryHours, setExpiryHours] = useState(24)
  const [customExpiry, setCustomExpiry] = useState('')
  const [password, setPassword] = useState('')
  const [maxDownloads, setMaxDownloads] = useState('')
  const [allowedIps, setAllowedIps] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  const [existingLinks, setExistingLinks] = useState<SecureShareLink[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadExistingLinks()
    }
  }, [isOpen, resourceId])

  const loadExistingLinks = async () => {
    setLoading(true)
    try {
      const links = await SecurityService.getUserShareLinks()
      const resourceLinks = links.filter(link => 
        (resourceType === 'asset' && link.asset_id === resourceId) ||
        (resourceType === 'folder' && link.folder_id === resourceId)
      )
      setExistingLinks(resourceLinks)
    } catch (error) {
      console.error('Failed to load existing links:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLink = async () => {
    setCreating(true)
    try {
      const options: ShareLinkOptions = {
        linkType,
        expiresInHours: expiryHours === 0 ? 
          Math.floor((new Date(customExpiry).getTime() - Date.now()) / (1000 * 60 * 60)) : 
          expiryHours,
        password: password || undefined,
        maxDownloads: maxDownloads ? parseInt(maxDownloads) : undefined,
        allowedIps: allowedIps ? allowedIps.split(',').map(ip => ip.trim()) : undefined
      }

      const result = await SecurityService.createShareLink(resourceId, resourceType, options)

      if (result.success && result.token) {
        setCreatedLink(result.token)
        await loadExistingLinks()
      } else {
        alert('Failed to create share link: ' + result.error)
      }
    } catch (error) {
      console.error('Failed to create share link:', error)
      alert('Failed to create share link')
    } finally {
      setCreating(false)
    }
  }

  const handleDeactivateLink = async (token: string) => {
    if (!confirm('Are you sure you want to deactivate this link?')) return

    try {
      const result = await SecurityService.deactivateShareLink(token)
      if (result.success) {
        await loadExistingLinks()
      } else {
        alert('Failed to deactivate link: ' + result.error)
      }
    } catch (error) {
      console.error('Failed to deactivate link:', error)
      alert('Failed to deactivate link')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Link copied to clipboard!')
    }).catch(() => {
      alert('Failed to copy link')
    })
  }

  const getShareUrl = (token: string) => {
    return `${window.location.origin}/share/${token}`
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Share "{resourceName}"
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {createdLink ? (
            <Card className="p-4 mb-6 bg-green-50 border-green-200">
              <h3 className="font-medium text-green-900 mb-2">Share Link Created!</h3>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={getShareUrl(createdLink)}
                  readOnly
                  className="flex-1 px-3 py-2 border border-green-300 rounded-md bg-white"
                />
                <Button
                  onClick={() => copyToClipboard(getShareUrl(createdLink))}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Copy
                </Button>
              </div>
              <Button
                onClick={() => setCreatedLink(null)}
                variant="outline"
                className="mt-3"
              >
                Create Another Link
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link Type
                </label>
                <div className="space-y-2">
                  {LINK_TYPES.map((type) => (
                    <label key={type.value} className="flex items-center">
                      <input
                        type="radio"
                        name="linkType"
                        value={type.value}
                        checked={linkType === type.value}
                        onChange={(e) => setLinkType(e.target.value as ShareLinkType)}
                        className="mr-3"
                      />
                      <div>
                        <span className="font-medium">{type.label}</span>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiry Time
                </label>
                <select
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {EXPIRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {expiryHours === 0 && (
                  <input
                    type="datetime-local"
                    value={customExpiry}
                    onChange={(e) => setCustomExpiry(e.target.value)}
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password Protection (Optional)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to protect the link"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {linkType === 'download' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Downloads (Optional)
                  </label>
                  <input
                    type="number"
                    value={maxDownloads}
                    onChange={(e) => setMaxDownloads(e.target.value)}
                    placeholder="Unlimited"
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IP Address Restrictions (Optional)
                </label>
                <input
                  type="text"
                  value={allowedIps}
                  onChange={(e) => setAllowedIps(e.target.value)}
                  placeholder="192.168.1.1, 10.0.0.1 (comma-separated)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-600 mt-1">
                  Leave empty to allow access from any IP address
                </p>
              </div>

              <Button
                onClick={handleCreateLink}
                disabled={creating || (expiryHours === 0 && !customExpiry)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {creating ? 'Creating Link...' : 'Create Secure Link'}
              </Button>
            </div>
          )}

          {/* Existing Links */}
          {existingLinks.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Existing Share Links</h3>
              <div className="space-y-3">
                {existingLinks.map((link) => (
                  <Card key={link.id} className={`p-4 ${isExpired(link.expires_at) ? 'bg-red-50' : 'bg-white'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            {LINK_TYPES.find(t => t.value === link.link_type)?.label}
                          </span>
                          {link.password_hash && (
                            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                              Password Protected
                            </span>
                          )}
                          {!link.is_active && (
                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                              Deactivated
                            </span>
                          )}
                          {isExpired(link.expires_at) && (
                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                              Expired
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Expires: {new Date(link.expires_at).toLocaleString()}
                        </p>
                        {link.max_downloads && (
                          <p className="text-sm text-gray-600">
                            Downloads: {link.download_count}/{link.max_downloads}
                          </p>
                        )}
                        {link.last_accessed_at && (
                          <p className="text-sm text-gray-600">
                            Last accessed: {new Date(link.last_accessed_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {link.is_active && !isExpired(link.expires_at) && (
                          <Button
                            onClick={() => copyToClipboard(getShareUrl(link.token))}
                            variant="outline"
                            className="text-blue-600"
                          >
                            Copy Link
                          </Button>
                        )}
                        <Button
                          onClick={() => handleDeactivateLink(link.token)}
                          variant="outline"
                          className="text-red-600"
                        >
                          Deactivate
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
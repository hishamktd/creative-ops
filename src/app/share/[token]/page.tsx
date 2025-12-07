'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'

interface ShareLinkData {
  valid: boolean
  assetId?: string
  folderId?: string
  linkType?: string
  error?: string
}

export default function ShareLinkPage() {
  const params = useParams()
  const token = params.token as string
  
  const [linkData, setLinkData] = useState<ShareLinkData | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [validating, setValidating] = useState(false)

  useEffect(() => {
    if (token) {
      validateShareLink()
    }
  }, [token])

  const validateShareLink = async (passwordAttempt?: string) => {
    setValidating(true)
    try {
      const params = new URLSearchParams()
      if (passwordAttempt) {
        params.append('password', passwordAttempt)
      }

      const response = await fetch(`/api/security/share-links/${token}?${params}`)
      const data = await response.json()

      if (response.ok && data.valid) {
        setLinkData(data)
        setPasswordRequired(false)
      } else {
        if (data.error?.includes('password')) {
          setPasswordRequired(true)
          setLinkData({ valid: false, error: data.error })
        } else {
          setLinkData({ valid: false, error: data.error })
        }
      }
    } catch (error) {
      console.error('Failed to validate share link:', error)
      setLinkData({ valid: false, error: 'Failed to validate share link' })
    } finally {
      setLoading(false)
      setValidating(false)
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password.trim()) {
      validateShareLink(password)
    }
  }

  const handleDownload = async () => {
    if (!linkData?.assetId) return

    try {
      // This would typically fetch the asset download URL
      // For now, we'll show a placeholder
      alert('Download functionality would be implemented here')
    } catch (error) {
      console.error('Download failed:', error)
      alert('Download failed')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 max-w-md w-full mx-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-full"></div>
          </div>
        </Card>
      </div>
    )
  }

  if (passwordRequired && (!linkData?.valid || linkData?.error?.includes('password'))) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Required</h1>
            <p className="text-gray-600">This shared content is password protected</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Enter Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter the password to access this content"
                required
              />
            </div>

            {linkData?.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{linkData.error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={validating || !password.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {validating ? 'Validating...' : 'Access Content'}
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  if (!linkData?.valid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-4">
              {linkData?.error || 'This share link is invalid or has expired'}
            </p>
            <Button
              onClick={() => window.location.href = '/'}
              variant="outline"
            >
              Go to Homepage
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Valid share link - show content based on type
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <Card className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Shared Content</h1>
            <p className="text-gray-600">
              Access type: {linkData.linkType?.charAt(0).toUpperCase() + linkData.linkType?.slice(1)}
            </p>
          </div>

          {linkData.assetId && (
            <div className="space-y-6">
              <div className="bg-gray-100 rounded-lg p-6 text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-600">Asset Preview</p>
                <p className="text-sm text-gray-500">Asset ID: {linkData.assetId}</p>
              </div>

              <div className="flex justify-center space-x-4">
                {linkData.linkType === 'download' && (
                  <Button
                    onClick={handleDownload}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Download Asset
                  </Button>
                )}
                
                {linkData.linkType === 'comment' && (
                  <Button
                    variant="outline"
                    className="border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    Add Comment
                  </Button>
                )}
              </div>
            </div>
          )}

          {linkData.folderId && (
            <div className="space-y-6">
              <div className="bg-gray-100 rounded-lg p-6 text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p className="text-gray-600">Shared Folder</p>
                <p className="text-sm text-gray-500">Folder ID: {linkData.folderId}</p>
              </div>

              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  This folder contains shared assets that you can access based on the link permissions.
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
              <span>🔒 Secure Share Link</span>
              <span>•</span>
              <span>Powered by CreativeOps</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
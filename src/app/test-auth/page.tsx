'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function TestAuthPage() {
  const { user, loading, login, logout, isAuthenticated, authDisabled } = useAuth()
  const { data: session, status } = useSession()

  const testLogin = async () => {
    await login('test@example.com', 'password123')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>NextAuth.js Test Page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Auth Status */}
            <div>
              <h3 className="font-semibold mb-2">Authentication Status</h3>
              <div className="bg-gray-100 p-3 rounded">
                <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
                <p><strong>Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
                <p><strong>Auth Disabled:</strong> {authDisabled ? 'Yes' : 'No'}</p>
                <p><strong>Session Status:</strong> {status}</p>
              </div>
            </div>

            {/* User Info */}
            {user && (
              <div>
                <h3 className="font-semibold mb-2">User Information</h3>
                <div className="bg-green-50 p-3 rounded">
                  <p><strong>ID:</strong> {user.id}</p>
                  <p><strong>Email:</strong> {user.email}</p>
                  <p><strong>Name:</strong> {user.name}</p>
                </div>
              </div>
            )}

            {/* Session Info */}
            {session && (
              <div>
                <h3 className="font-semibold mb-2">Session Information</h3>
                <div className="bg-blue-50 p-3 rounded">
                  <pre className="text-sm overflow-auto">
                    {JSON.stringify(session, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <h3 className="font-semibold">Actions</h3>
              {!isAuthenticated ? (
                <div className="space-x-2">
                  <Button onClick={testLogin}>
                    Test Login
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/login">Go to Login</a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/signup">Go to Signup</a>
                  </Button>
                </div>
              ) : (
                <Button onClick={logout} variant="danger">
                  Logout
                </Button>
              )}
            </div>

            {/* Environment Info */}
            <div>
              <h3 className="font-semibold mb-2">Environment</h3>
              <div className="bg-yellow-50 p-3 rounded text-sm">
                <p><strong>DISABLE_AUTH:</strong> {process.env.NEXT_PUBLIC_DISABLE_AUTH}</p>
                <p><strong>SKIP_EMAIL_VERIFICATION:</strong> {process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION}</p>
                <p><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
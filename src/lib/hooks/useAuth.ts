'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useState } from 'react'

interface SignupData {
  email: string
  password: string
  fullName: string
  role?: string
}

export function useAuth() {
  const { data: session, status } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const login = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid credentials')
        setLoading(false)
        return { success: false, error: 'Invalid credentials' }
      }

      setLoading(false)
      return { success: true, error: null }
    } catch (err) {
      const errorMessage = 'Login failed'
      setError(errorMessage)
      setLoading(false)
      return { success: false, error: errorMessage }
    }
  }

  const signup = async (data: SignupData) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Signup failed')
        setLoading(false)
        return { success: false, error: result.error || 'Signup failed' }
      }

      // Auto-login after successful signup if email verification is disabled
      if (process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === 'true') {
        const loginResult = await login(data.email, data.password)
        return loginResult
      }

      setLoading(false)
      return { 
        success: true, 
        error: null,
        needsVerification: process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION !== 'true'
      }
    } catch (err) {
      const errorMessage = 'Signup failed'
      setError(errorMessage)
      setLoading(false)
      return { success: false, error: errorMessage }
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await signOut({ redirect: false })
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      setLoading(false)
    }
  }

  const clearError = () => setError(null)

  return {
    user: session?.user || null,
    loading: status === 'loading' || loading,
    error,
    login,
    signup,
    logout,
    clearError,
    isAuthenticated: !!session?.user,
    authDisabled: process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'
  }
}
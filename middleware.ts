import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Check if authentication is disabled
    if (process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true') {
      return NextResponse.next()
    }

    // If we reach here, NextAuth has already verified the token
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // If auth is disabled, allow all requests
        if (process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true') {
          return true
        }

        // Check if route requires authentication
        const protectedRoutes = [
          '/dashboard',
          '/projects',
          '/tasks',
          '/assets',
          '/feedback',
          '/team',
          '/invoices',
          '/settings'
        ]

        const isProtectedRoute = protectedRoutes.some(route => 
          req.nextUrl.pathname.startsWith(route)
        )

        // If it's a protected route, require authentication
        if (isProtectedRoute) {
          return !!token
        }

        // For auth pages, redirect if already authenticated
        if ((req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup') && token) {
          return false // This will trigger a redirect
        }

        // Allow all other routes
        return true
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/tasks/:path*',
    '/assets/:path*',
    '/feedback/:path*',
    '/team/:path*',
    '/invoices/:path*',
    '/settings/:path*',
    '/login',
    '/signup',
  ],
}

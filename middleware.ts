import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protect dashboard routes
  if (req.nextUrl.pathname.startsWith('/dashboard') ||
      req.nextUrl.pathname.startsWith('/projects') ||
      req.nextUrl.pathname.startsWith('/tasks') ||
      req.nextUrl.pathname.startsWith('/assets') ||
      req.nextUrl.pathname.startsWith('/feedback') ||
      req.nextUrl.pathname.startsWith('/team') ||
      req.nextUrl.pathname.startsWith('/invoices') ||
      req.nextUrl.pathname.startsWith('/settings')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  // Redirect authenticated users from auth pages
  if ((req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup') && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

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

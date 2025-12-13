import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Home, ArrowLeft, Lock } from 'lucide-react'

export default function AuthNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="py-12">
          <div className="mb-8">
            <div className="flex justify-center mb-4">
              <Lock className="w-16 h-16 text-gray-300" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Auth Page Not Found</h1>
            <p className="text-gray-600">
              The authentication page you're looking for doesn't exist.
            </p>
          </div>

          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/login">
                <Lock className="w-4 h-4" />
                Go to Login
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="w-full">
              <Link href="/">
                <Home className="w-4 h-4" />
                Go Home
              </Link>
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-3">Need an account?</p>
            <Button variant="ghost" asChild className="text-sm">
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
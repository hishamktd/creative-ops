import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Home, ArrowLeft, FolderOpen } from 'lucide-react'

export default function DashboardNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="py-12">
          <div className="mb-8">
            <div className="flex justify-center mb-4">
              <FolderOpen className="w-16 h-16 text-gray-300" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
            <p className="text-gray-600">
              The dashboard page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/dashboard">
                <Home className="w-4 h-4" />
                Go to Dashboard
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="w-full">
              <Link href="javascript:history.back()">
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </Link>
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-3">Quick Links</p>
            <div className="space-y-2">
              <Button variant="ghost" asChild className="text-sm w-full">
                <Link href="/projects">Projects</Link>
              </Button>
              <Button variant="ghost" asChild className="text-sm w-full">
                <Link href="/tasks">Tasks</Link>
              </Button>
              <Button variant="ghost" asChild className="text-sm w-full">
                <Link href="/assets">Assets</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
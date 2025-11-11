'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  FolderOpen,
  MessageSquare,
  Users,
  FileText,
  Settings,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user } = useAuth()

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Assets', href: '/assets', icon: FolderOpen },
    { name: 'Feedback', href: '/feedback', icon: MessageSquare },
    { name: 'Team Activity', href: '/team', icon: Users },
    { name: 'Invoices', href: '/invoices', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/')
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-30 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => onClose()}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                    active
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* AI Features Placeholder */}
          <div className="p-4 border-t border-gray-200">
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={20} className="text-primary-600" />
                <h3 className="font-semibold text-gray-900 text-sm">AI Assistant</h3>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                AI-powered feedback summaries coming soon
              </p>
              <button className="w-full bg-white text-primary-600 text-sm font-medium py-2 rounded-lg hover:bg-primary-50 transition">
                Learn More
              </button>
            </div>
          </div>

          {/* User XP */}
          {user && (
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Level Progress</span>
                <span className="text-sm font-bold text-primary-600">{user.xp_points} XP</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(user.xp_points % 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

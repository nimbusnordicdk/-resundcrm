'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { CommandPalette } from '@/components/CommandPalette'
import { cn } from '@/utils/cn'
import type { User } from '@/types/database'

interface DashboardLayoutProps {
  children: React.ReactNode
  user: User | null
}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      {/* Background decorations - only in dark mode */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none dark:block hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-600/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern overlay - only in dark mode */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none dark:block hidden"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Command Palette */}
      <CommandPalette />

      <Sidebar
        role={user?.role || 'saelger'}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div
        className={cn(
          'relative min-h-screen transition-all duration-300',
          sidebarOpen ? 'lg:ml-72' : 'lg:ml-20'
        )}
      >
        <Header user={user} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="relative p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

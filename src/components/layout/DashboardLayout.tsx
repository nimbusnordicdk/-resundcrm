'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { cn } from '@/utils/cn'
import type { User } from '@/types/database'

interface DashboardLayoutProps {
  children: React.ReactNode
  user: User | null
}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <Sidebar
        role={user?.role || 'saelger'}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div
        className={cn(
          'min-h-screen transition-all duration-300',
          sidebarOpen ? 'lg:ml-72' : 'lg:ml-20'
        )}
      >
        <Header user={user} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

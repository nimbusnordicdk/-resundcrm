'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/utils/cn'
import {
  LayoutDashboard,
  Building2,
  Users,
  FolderOpen,
  MessageSquare,
  Phone,
  FileText,
  Receipt,
  Wallet,
  Calendar,
  Target,
  ChevronDown,
  ChevronLeft,
  Menu,
  BarChart3,
} from 'lucide-react'
import type { UserRole } from '@/types/database'

interface SidebarProps {
  role: UserRole
  isOpen: boolean
  onToggle: () => void
}

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  children?: { title: string; href: string }[]
}

const adminNav: NavItem[] = [
  { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { title: 'Øresund Stats', href: '/admin/stats', icon: BarChart3 },
  { title: 'Alle Bureauer', href: '/admin/bureauer', icon: Building2 },
  { title: 'Alle Ansatte', href: '/admin/ansatte', icon: Users },
  { title: 'Filer', href: '/admin/filer', icon: FolderOpen },
  { title: 'Chat', href: '/admin/chat', icon: MessageSquare },
  { title: 'Kampagner Kold', href: '/admin/kampagner', icon: Target },
  { title: 'Kontraktrum', href: '/admin/kontrakter', icon: FileText },
  { title: 'Fakturaer', href: '/admin/fakturaer', icon: Receipt },
  { title: 'Løn', href: '/admin/loen', icon: Wallet },
]

const saelgerNav: NavItem[] = [
  { title: 'Dashboard', href: '/saelger', icon: LayoutDashboard },
  { title: 'Øresund Stats', href: '/saelger/stats', icon: BarChart3 },
  { title: 'Møder', href: '/saelger/moeder', icon: Calendar },
  { title: 'Koldkampagner', href: '/saelger/koldkampagner', icon: Target },
  { title: 'Bureau Kampagner', href: '/saelger/bureaukampagner', icon: Building2 },
  { title: 'Chat', href: '/saelger/chat', icon: MessageSquare },
  { title: 'Ring Op', href: '/saelger/ring-op', icon: Phone },
  { title: 'Kontrakter', href: '/saelger/kontrakter', icon: FileText },
]

const bureauNav: NavItem[] = [
  { title: 'Dashboard', href: '/bureau', icon: LayoutDashboard },
  { title: 'Alle Kunder', href: '/bureau/kunder', icon: Users },
  { title: 'Faktura', href: '/bureau/faktura', icon: Receipt },
  { title: 'Chat', href: '/bureau/chat', icon: MessageSquare },
  { title: 'Filer', href: '/bureau/filer', icon: FolderOpen },
]

export default function Sidebar({ role, isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const navItems = role === 'admin' ? adminNav : role === 'saelger' ? saelgerNav : bureauNav

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    )
  }

  const isActive = (href: string) => {
    if (href === '/admin' || href === '/saelger' || href === '/bureau') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen bg-white dark:bg-dark-sidebar border-r border-gray-200 dark:border-dark-border transition-all duration-300 ease-in-out',
          isOpen ? 'w-72' : 'w-0 lg:w-20',
          'lg:translate-x-0',
          !isOpen && '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-dark-border">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">Ø</span>
            </div>
            {isOpen && (
              <span className="text-gray-900 dark:text-white font-semibold text-lg whitespace-nowrap">
                Øresund Partners
              </span>
            )}
          </Link>
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors lg:hidden"
          >
            <ChevronLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
          {navItems.map((item) => (
            <div key={item.title}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleExpand(item.title)}
                    className={cn(
                      'sidebar-link w-full justify-between',
                      expandedItems.includes(item.title) && 'bg-gray-100 dark:bg-dark-hover'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {isOpen && <span>{item.title}</span>}
                    </div>
                    {isOpen && (
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 transition-transform',
                          expandedItems.includes(item.title) && 'rotate-180'
                        )}
                      />
                    )}
                  </button>
                  {isOpen && expandedItems.includes(item.title) && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'sidebar-link text-sm',
                            isActive(child.href) && 'sidebar-link-active'
                          )}
                        >
                          {child.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    'sidebar-link',
                    isActive(item.href) && 'sidebar-link-active',
                    !isOpen && 'justify-center px-2'
                  )}
                  title={!isOpen ? item.title : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {isOpen && <span>{item.title}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}

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
  PhoneCall,
  FileText,
  Receipt,
  Wallet,
  Calendar,
  Target,
  ChevronDown,
  ChevronLeft,
  BarChart3,
  Sparkles,
  GraduationCap,
  BookOpen,
  LogOut,
  Settings,
  Mail,
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
  { title: 'ØresundAI', href: '/admin/ai', icon: Sparkles },
  { title: 'Øresund Stats', href: '/admin/stats', icon: BarChart3 },
  { title: 'Alle Bureauer', href: '/admin/bureauer', icon: Building2 },
  { title: 'Alle Ansatte', href: '/admin/ansatte', icon: Users },
  { title: 'Uddannelse', href: '/admin/uddannelse', icon: GraduationCap },
  { title: 'Filer', href: '/admin/filer', icon: FolderOpen },
  { title: 'Chat', href: '/admin/chat', icon: MessageSquare },
  { title: 'Kampagner Kold', href: '/admin/kampagner', icon: Target },
  { title: 'Kontraktrum', href: '/admin/kontrakter', icon: FileText },
  { title: 'Fakturaer', href: '/admin/fakturaer', icon: Receipt },
  { title: 'Løn', href: '/admin/loen', icon: Wallet },
]

const saelgerNav: NavItem[] = [
  { title: 'Dashboard', href: '/saelger', icon: LayoutDashboard },
  { title: 'ØresundAI', href: '/saelger/ai', icon: Sparkles },
  { title: 'Øresund Stats', href: '/saelger/stats', icon: BarChart3 },
  { title: 'Email', href: '/saelger/email', icon: Mail },
  { title: 'Møder', href: '/saelger/moeder', icon: Calendar },
  { title: 'Koldkampagner', href: '/saelger/koldkampagner', icon: Target },
  { title: 'Bureau Kampagner', href: '/saelger/bureaukampagner', icon: Building2 },
  { title: 'Chat', href: '/saelger/chat', icon: MessageSquare },
  { title: 'Ring Op', href: '/saelger/ring-op', icon: Phone },
  { title: 'Autodialer', href: '/saelger/autodialer', icon: PhoneCall },
  { title: 'Kontrakter', href: '/saelger/kontrakter', icon: FileText },
  { title: 'E-Learning', href: '/saelger/e-learning', icon: BookOpen },
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
          className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar - Always dark */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen transition-all duration-300 ease-in-out',
          'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-white/10',
          isOpen ? 'w-72' : 'w-0 lg:w-20',
          'lg:translate-x-0',
          !isOpen && '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Decorative gradient orb */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 left-0 w-32 h-32 bg-primary-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center justify-between h-16 px-4 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary-400 to-primary-600 rounded-xl blur opacity-40 group-hover:opacity-70 transition duration-300" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">Ø</span>
              </div>
            </div>
            {isOpen && (
              <span className="text-white font-semibold text-lg whitespace-nowrap">
                Øresund Partners
              </span>
            )}
          </Link>
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors lg:hidden"
          >
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="relative p-3 space-y-1 overflow-y-auto h-[calc(100vh-10rem)]">
          {navItems.map((item) => (
            <div key={item.title}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleExpand(item.title)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200',
                      expandedItems.includes(item.title) && 'bg-white/5 text-white'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {isOpen && <span className="text-sm font-medium">{item.title}</span>}
                    </div>
                    {isOpen && (
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 transition-transform duration-200',
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
                            'block px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200',
                            isActive(child.href) && 'text-white bg-primary-500/20'
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
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:text-white transition-all duration-200',
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/10 text-white border border-primary-500/20'
                      : 'hover:bg-white/5',
                    !isOpen && 'justify-center px-2'
                  )}
                  title={!isOpen ? item.title : undefined}
                >
                  <item.icon className={cn(
                    'w-5 h-5 flex-shrink-0 transition-colors',
                    isActive(item.href) && 'text-primary-400'
                  )} />
                  {isOpen && <span className="text-sm font-medium">{item.title}</span>}
                  {isActive(item.href) && isOpen && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-400" />
                  )}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* Bottom Section */}
        {isOpen && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-slate-950/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 flex items-center justify-center border border-white/10">
                <span className="text-primary-400 font-semibold text-sm">
                  {role === 'admin' ? 'AD' : role === 'saelger' ? 'SL' : 'BU'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {role === 'admin' ? 'Administrator' : role === 'saelger' ? 'Sælger' : 'Bureau'}
                </p>
                <p className="text-xs text-gray-500 truncate">Logget ind</p>
              </div>
              <Link
                href="/api/auth/logout"
                className="p-2 rounded-lg hover:bg-white/10 text-gray-500 hover:text-red-400 transition-colors"
                title="Log ud"
              >
                <LogOut className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

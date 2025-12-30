'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Dialog, Transition } from '@headlessui/react'
import {
  Search,
  FileText,
  Users,
  Phone,
  PhoneCall,
  Building2,
  Calendar,
  GraduationCap,
  BarChart3,
  Home,
  X,
  Command,
  ArrowRight,
  Loader2,
  MessageSquare,
  FolderOpen,
  Target,
  Receipt,
  Wallet,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import type { UserRole } from '@/types/database'

interface SearchResult {
  id: string
  type: 'lead' | 'customer' | 'contract' | 'call' | 'meeting' | 'lesson' | 'page' | 'bureau' | 'employee'
  title: string
  subtitle?: string
  icon: React.ReactNode
  href: string
}

// Quick links per role
const adminQuickLinks: SearchResult[] = [
  { id: 'dashboard', type: 'page', title: 'Dashboard', subtitle: 'Gå til oversigt', icon: <Home className="w-5 h-5" />, href: '/admin' },
  { id: 'ai', type: 'page', title: 'ØresundAI', subtitle: 'AI Analytics', icon: <Sparkles className="w-5 h-5" />, href: '/admin/ai' },
  { id: 'stats', type: 'page', title: 'Øresund Stats', subtitle: 'Statistikker', icon: <BarChart3 className="w-5 h-5" />, href: '/admin/stats' },
  { id: 'bureauer', type: 'page', title: 'Alle Bureauer', subtitle: 'Administrer bureauer', icon: <Building2 className="w-5 h-5" />, href: '/admin/bureauer' },
  { id: 'ansatte', type: 'page', title: 'Alle Ansatte', subtitle: 'Administrer ansatte', icon: <Users className="w-5 h-5" />, href: '/admin/ansatte' },
  { id: 'uddannelse', type: 'page', title: 'Uddannelse', subtitle: 'E-learning administration', icon: <GraduationCap className="w-5 h-5" />, href: '/admin/uddannelse' },
  { id: 'filer', type: 'page', title: 'Filer', subtitle: 'Dokumenter og filer', icon: <FolderOpen className="w-5 h-5" />, href: '/admin/filer' },
  { id: 'chat', type: 'page', title: 'Chat', subtitle: 'Beskeder', icon: <MessageSquare className="w-5 h-5" />, href: '/admin/chat' },
  { id: 'kampagner', type: 'page', title: 'Kampagner Kold', subtitle: 'Koldkampagner', icon: <Target className="w-5 h-5" />, href: '/admin/kampagner' },
  { id: 'kontrakter', type: 'page', title: 'Kontraktrum', subtitle: 'Alle kontrakter', icon: <FileText className="w-5 h-5" />, href: '/admin/kontrakter' },
  { id: 'fakturaer', type: 'page', title: 'Fakturaer', subtitle: 'Fakturaoversigt', icon: <Receipt className="w-5 h-5" />, href: '/admin/fakturaer' },
  { id: 'loen', type: 'page', title: 'Løn', subtitle: 'Lønadministration', icon: <Wallet className="w-5 h-5" />, href: '/admin/loen' },
]

const saelgerQuickLinks: SearchResult[] = [
  { id: 'dashboard', type: 'page', title: 'Dashboard', subtitle: 'Gå til oversigt', icon: <Home className="w-5 h-5" />, href: '/saelger' },
  { id: 'ai', type: 'page', title: 'ØresundAI', subtitle: 'AI Analytics', icon: <Sparkles className="w-5 h-5" />, href: '/saelger/ai' },
  { id: 'stats', type: 'page', title: 'Øresund Stats', subtitle: 'Din statistik', icon: <BarChart3 className="w-5 h-5" />, href: '/saelger/stats' },
  { id: 'moeder', type: 'page', title: 'Møder', subtitle: 'Se kalender', icon: <Calendar className="w-5 h-5" />, href: '/saelger/moeder' },
  { id: 'koldkampagner', type: 'page', title: 'Koldkampagner', subtitle: 'Dine kampagner', icon: <Target className="w-5 h-5" />, href: '/saelger/koldkampagner' },
  { id: 'bureaukampagner', type: 'page', title: 'Bureau Kampagner', subtitle: 'Bureau leads', icon: <Building2 className="w-5 h-5" />, href: '/saelger/bureaukampagner' },
  { id: 'chat', type: 'page', title: 'Chat', subtitle: 'Beskeder', icon: <MessageSquare className="w-5 h-5" />, href: '/saelger/chat' },
  { id: 'ring-op', type: 'page', title: 'Ring Op', subtitle: 'Manuel opkald', icon: <Phone className="w-5 h-5" />, href: '/saelger/ring-op' },
  { id: 'autodialer', type: 'page', title: 'Autodialer', subtitle: 'Start opkald', icon: <PhoneCall className="w-5 h-5" />, href: '/saelger/autodialer' },
  { id: 'kontrakter', type: 'page', title: 'Kontrakter', subtitle: 'Dine kontrakter', icon: <FileText className="w-5 h-5" />, href: '/saelger/kontrakter' },
  { id: 'elearning', type: 'page', title: 'E-Learning', subtitle: 'Uddannelse', icon: <BookOpen className="w-5 h-5" />, href: '/saelger/e-learning' },
]

const bureauQuickLinks: SearchResult[] = [
  { id: 'dashboard', type: 'page', title: 'Dashboard', subtitle: 'Gå til oversigt', icon: <Home className="w-5 h-5" />, href: '/bureau' },
  { id: 'kunder', type: 'page', title: 'Alle Kunder', subtitle: 'Se dine kunder', icon: <Users className="w-5 h-5" />, href: '/bureau/kunder' },
  { id: 'faktura', type: 'page', title: 'Faktura', subtitle: 'Dine fakturaer', icon: <Receipt className="w-5 h-5" />, href: '/bureau/faktura' },
  { id: 'chat', type: 'page', title: 'Chat', subtitle: 'Beskeder', icon: <MessageSquare className="w-5 h-5" />, href: '/bureau/chat' },
  { id: 'filer', type: 'page', title: 'Filer', subtitle: 'Dokumenter', icon: <FolderOpen className="w-5 h-5" />, href: '/bureau/filer' },
]

const typeIcons = {
  lead: <Users className="w-5 h-5 text-blue-400" />,
  customer: <Building2 className="w-5 h-5 text-green-400" />,
  contract: <FileText className="w-5 h-5 text-purple-400" />,
  call: <Phone className="w-5 h-5 text-orange-400" />,
  meeting: <Calendar className="w-5 h-5 text-pink-400" />,
  lesson: <GraduationCap className="w-5 h-5 text-cyan-400" />,
  page: <ArrowRight className="w-5 h-5 text-gray-400" />,
  bureau: <Building2 className="w-5 h-5 text-indigo-400" />,
  employee: <Users className="w-5 h-5 text-emerald-400" />,
}

const typeLabels = {
  lead: 'Lead',
  customer: 'Kunde',
  contract: 'Kontrakt',
  call: 'Opkald',
  meeting: 'Møde',
  lesson: 'Lektion',
  page: 'Side',
  bureau: 'Bureau',
  employee: 'Ansat',
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Fetch user role
  useEffect(() => {
    async function fetchUserRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        if (userData) {
          setUserRole(userData.role as UserRole)
        }
      }
    }
    fetchUserRole()
  }, [supabase])

  // Get quick links based on role
  const getQuickLinks = useCallback(() => {
    switch (userRole) {
      case 'admin':
        return adminQuickLinks
      case 'saelger':
        return saelgerQuickLinks
      case 'bureau':
        return bureauQuickLinks
      default:
        return []
    }
  }, [userRole])

  // Get base path for role
  const getBasePath = useCallback(() => {
    switch (userRole) {
      case 'admin':
        return '/admin'
      case 'saelger':
        return '/saelger'
      case 'bureau':
        return '/bureau'
      default:
        return ''
    }
  }, [userRole])

  // Open/close with CMD+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Search function
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !userRole) {
      setResults([])
      return
    }

    setLoading(true)
    const searchResults: SearchResult[] = []
    const basePath = getBasePath()

    try {
      // Admin-specific searches
      if (userRole === 'admin') {
        // Search bureaus
        const { data: bureaus } = await supabase
          .from('bureaus')
          .select('id, name, email')
          .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .limit(5)

        if (bureaus) {
          bureaus.forEach((bureau) => {
            searchResults.push({
              id: bureau.id,
              type: 'bureau',
              title: bureau.name,
              subtitle: bureau.email,
              icon: typeIcons.bureau,
              href: `${basePath}/bureauer/${bureau.id}`,
            })
          })
        }

        // Search employees/users
        const { data: employees } = await supabase
          .from('users')
          .select('id, full_name, email, role')
          .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .limit(5)

        if (employees) {
          employees.forEach((emp) => {
            searchResults.push({
              id: emp.id,
              type: 'employee',
              title: emp.full_name || 'Ukendt',
              subtitle: `${emp.role} - ${emp.email}`,
              icon: typeIcons.employee,
              href: `${basePath}/ansatte/${emp.id}`,
            })
          })
        }

        // Search contracts (admin sees all)
        const { data: contracts } = await supabase
          .from('contracts')
          .select('id, name, status')
          .ilike('name', `%${searchQuery}%`)
          .limit(5)

        if (contracts) {
          contracts.forEach((contract) => {
            searchResults.push({
              id: contract.id,
              type: 'contract',
              title: contract.name,
              subtitle: `Status: ${contract.status}`,
              icon: typeIcons.contract,
              href: `${basePath}/kontrakter/${contract.id}`,
            })
          })
        }
      }

      // Sælger-specific searches
      if (userRole === 'saelger') {
        // Search leads
        const { data: leads } = await supabase
          .from('leads')
          .select('id, name, company_name, phone')
          .or(`name.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
          .limit(5)

        if (leads) {
          leads.forEach((lead) => {
            searchResults.push({
              id: lead.id,
              type: 'lead',
              title: lead.name || lead.company_name || 'Ukendt',
              subtitle: lead.phone || lead.company_name,
              icon: typeIcons.lead,
              href: `${basePath}/leads/${lead.id}`,
            })
          })
        }

        // Search meetings
        const { data: meetings } = await supabase
          .from('meetings')
          .select('id, title, date')
          .ilike('title', `%${searchQuery}%`)
          .limit(5)

        if (meetings) {
          meetings.forEach((meeting) => {
            searchResults.push({
              id: meeting.id,
              type: 'meeting',
              title: meeting.title,
              subtitle: new Date(meeting.date).toLocaleDateString('da-DK'),
              icon: typeIcons.meeting,
              href: `${basePath}/moeder`,
            })
          })
        }

        // Search contracts
        const { data: contracts } = await supabase
          .from('contracts')
          .select('id, name, status')
          .ilike('name', `%${searchQuery}%`)
          .limit(5)

        if (contracts) {
          contracts.forEach((contract) => {
            searchResults.push({
              id: contract.id,
              type: 'contract',
              title: contract.name,
              subtitle: `Status: ${contract.status}`,
              icon: typeIcons.contract,
              href: `${basePath}/kontrakter/${contract.id}`,
            })
          })
        }

        // Search lessons
        const { data: lessons } = await supabase
          .from('lessons')
          .select('id, title, description')
          .ilike('title', `%${searchQuery}%`)
          .limit(5)

        if (lessons) {
          lessons.forEach((lesson) => {
            searchResults.push({
              id: lesson.id,
              type: 'lesson',
              title: lesson.title,
              subtitle: lesson.description?.substring(0, 50) + '...',
              icon: typeIcons.lesson,
              href: `${basePath}/e-learning/${lesson.id}`,
            })
          })
        }
      }

      // Bureau-specific searches
      if (userRole === 'bureau') {
        // Search customers
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name, email, phone')
          .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
          .limit(5)

        if (customers) {
          customers.forEach((customer) => {
            searchResults.push({
              id: customer.id,
              type: 'customer',
              title: customer.name,
              subtitle: customer.email || customer.phone,
              icon: typeIcons.customer,
              href: `${basePath}/kunder/${customer.id}`,
            })
          })
        }
      }

      // Filter quick links based on role
      const quickLinks = getQuickLinks()
      const filteredQuickLinks = quickLinks.filter(
        (link) =>
          link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          link.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
      )

      setResults([...searchResults, ...filteredQuickLinks])
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, userRole, getBasePath, getQuickLinks])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, search])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = query ? results : getQuickLinks()

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = items[selectedIndex]
      if (selected) {
        router.push(selected.href)
        setIsOpen(false)
      }
    }
  }

  const displayItems = query ? results : getQuickLinks()

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={setIsOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 md:p-20">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="mx-auto max-w-2xl transform overflow-hidden rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-white/10 shadow-2xl transition-all">
              {/* Search Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setSelectedIndex(0)
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent border-0 border-b border-white/10 pl-12 pr-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-0 text-lg"
                  placeholder={
                    userRole === 'admin'
                      ? "Søg efter bureauer, ansatte, kontrakter..."
                      : userRole === 'saelger'
                      ? "Søg efter leads, møder, kontrakter..."
                      : "Søg efter kunder, fakturaer..."
                  }
                  autoFocus
                />
                {loading && (
                  <div className="absolute inset-y-0 right-12 flex items-center">
                    <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                  </div>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                >
                  <X className="h-5 w-5 text-gray-500 hover:text-gray-300" />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-96 overflow-y-auto py-2">
                {!query && (
                  <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hurtige genveje
                  </div>
                )}

                {query && results.length === 0 && !loading && (
                  <div className="px-4 py-12 text-center">
                    <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Ingen resultater fundet for "{query}"</p>
                    <p className="text-gray-600 text-sm mt-1">Prøv at søge på noget andet</p>
                  </div>
                )}

                {displayItems.map((item, index) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => {
                      router.push(item.href)
                      setIsOpen(false)
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full px-4 py-3 flex items-center gap-4 transition-colors ${
                      index === selectedIndex
                        ? 'bg-primary-500/20 text-white'
                        : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      index === selectedIndex ? 'bg-primary-500/30' : 'bg-white/5'
                    }`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-sm text-gray-500">{item.subtitle}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        index === selectedIndex
                          ? 'bg-primary-500/30 text-primary-300'
                          : 'bg-white/5 text-gray-500'
                      }`}>
                        {typeLabels[item.type]}
                      </span>
                      {index === selectedIndex && (
                        <ArrowRight className="w-4 h-4 text-primary-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-white/10 px-4 py-3 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">↓</kbd>
                    naviger
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">↵</kbd>
                    åbn
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">esc</kbd>
                    luk
                  </span>
                </div>
                <div className="flex items-center gap-1 text-gray-600">
                  <Command className="w-3 h-3" />
                  <span>K for at åbne</span>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

// Search trigger button component
export function SearchTrigger() {
  return (
    <button
      onClick={() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
      }}
      className="flex items-center gap-3 w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
    >
      <Search className="w-4 h-4 text-gray-500 group-hover:text-gray-400" />
      <span className="flex-1 text-left text-sm text-gray-500 group-hover:text-gray-400">Søg...</span>
      <kbd className="hidden sm:flex items-center gap-0.5 px-2 py-0.5 bg-white/5 rounded text-xs text-gray-600 border border-white/10">
        <Command className="w-3 h-3" />
        K
      </kbd>
    </button>
  )
}

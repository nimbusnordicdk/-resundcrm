'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Menu,
  Bell,
  Search,
  ChevronDown,
  Settings,
  LogOut,
  FileText,
  MessageSquare,
  Users,
  Building2,
  Target,
  X,
  Loader2,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import type { User } from '@/types/database'
import toast from 'react-hot-toast'

interface Notification {
  id: string
  type: 'document' | 'chat'
  title: string
  message: string
  created_at: string
  read: boolean
  link?: string
}

interface SearchResult {
  id: string
  type: 'customer' | 'lead' | 'user' | 'bureau'
  title: string
  subtitle?: string
  link: string
}

interface HeaderProps {
  user: User | null
  onMenuClick: () => void
}

export default function Header({ user, onMenuClick }: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
        setShowNotifications(false)
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search functionality
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setIsSearching(true)
    setShowSearchResults(true)

    try {
      const results: SearchResult[] = []
      const searchTerm = `%${query}%`

      // Search customers
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .or(`name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`)
        .limit(5)

      customers?.forEach((c) => {
        results.push({
          id: c.id,
          type: 'customer',
          title: c.name,
          subtitle: c.email || c.phone || undefined,
          link: user?.role === 'bureau' ? `/bureau/kunder` : `/admin/bureauer`,
        })
      })

      // Search leads
      const { data: leads } = await supabase
        .from('leads')
        .select('id, name, company, phone, email')
        .or(`name.ilike.${searchTerm},company.ilike.${searchTerm},phone.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5)

      leads?.forEach((l) => {
        results.push({
          id: l.id,
          type: 'lead',
          title: l.name,
          subtitle: l.company || l.email || undefined,
          link: user?.role === 'admin' ? `/admin/kampagner` : `/${user?.role}/koldkampagner`,
        })
      })

      // Search users (admin only)
      if (user?.role === 'admin') {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, email, role')
          .or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
          .limit(5)

        users?.forEach((u) => {
          results.push({
            id: u.id,
            type: 'user',
            title: u.full_name,
            subtitle: u.email,
            link: `/admin/ansatte`,
          })
        })

        // Search bureaus
        const { data: bureaus } = await supabase
          .from('bureaus')
          .select('id, name, contact_person, email')
          .or(`name.ilike.${searchTerm},contact_person.ilike.${searchTerm},email.ilike.${searchTerm}`)
          .limit(5)

        bureaus?.forEach((b) => {
          results.push({
            id: b.id,
            type: 'bureau',
            title: b.name,
            subtitle: b.contact_person,
            link: `/admin/bureauer`,
          })
        })
      }

      setSearchResults(results)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }, [user?.role])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, performSearch])

  const handleSearchResultClick = (result: SearchResult) => {
    router.push(result.link)
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
  }

  const getSearchIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'customer':
        return <Users className="w-4 h-4 text-green-500" />
      case 'lead':
        return <Target className="w-4 h-4 text-orange-500" />
      case 'user':
        return <Users className="w-4 h-4 text-blue-500" />
      case 'bureau':
        return <Building2 className="w-4 h-4 text-purple-500" />
    }
  }

  const getSearchTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'customer':
        return 'Kunde'
      case 'lead':
        return 'Lead'
      case 'user':
        return 'Bruger'
      case 'bureau':
        return 'Bureau'
    }
  }

  // Fetch unread chat messages count
  useEffect(() => {
    if (!user) return

    async function fetchUnreadMessages() {
      // Get rooms the user is part of
      const { data: participantRooms } = await supabase
        .from('chat_participants')
        .select('room_id, last_read_at')
        .eq('user_id', user!.id)

      if (!participantRooms || participantRooms.length === 0) {
        setUnreadCount(0)
        return
      }

      // Count unread messages across all rooms
      let totalUnread = 0
      const newNotifications: Notification[] = []

      for (const room of participantRooms) {
        const lastReadAt = room.last_read_at || '1970-01-01'

        const { data: unreadMessages, count } = await supabase
          .from('chat_messages')
          .select('*, sender:users(full_name)', { count: 'exact' })
          .eq('room_id', room.room_id)
          .neq('sender_id', user!.id)
          .gt('created_at', lastReadAt)
          .order('created_at', { ascending: false })
          .limit(5)

        if (count && count > 0) {
          totalUnread += count

          // Add notifications for recent messages
          unreadMessages?.forEach((msg: any) => {
            newNotifications.push({
              id: msg.id,
              type: 'chat',
              title: 'Ny besked',
              message: `${msg.sender?.full_name || 'Ukendt'}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`,
              created_at: msg.created_at,
              read: false,
              link: `/${user!.role}/chat`,
            })
          })
        }
      }

      // Sort notifications by date
      newNotifications.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setNotifications(newNotifications.slice(0, 10))
      setUnreadCount(totalUnread)
    }

    fetchUnreadMessages()

    // Subscribe to new chat messages
    const channel = supabase
      .channel('header-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        async (payload) => {
          // Check if user is part of this room
          const { data: isParticipant } = await supabase
            .from('chat_participants')
            .select('room_id')
            .eq('room_id', payload.new.room_id)
            .eq('user_id', user!.id)
            .single()

          if (isParticipant && payload.new.sender_id !== user!.id) {
            // Fetch sender info
            const { data: sender } = await supabase
              .from('users')
              .select('full_name')
              .eq('id', payload.new.sender_id)
              .single()

            const newNotification: Notification = {
              id: payload.new.id,
              type: 'chat',
              title: 'Ny besked',
              message: `${sender?.full_name || 'Ukendt'}: ${payload.new.content.substring(0, 50)}`,
              created_at: payload.new.created_at,
              read: false,
              link: `/${user!.role}/chat`,
            }

            setNotifications((prev) => [newNotification, ...prev].slice(0, 10))
            setUnreadCount((prev) => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Logget ud')
    router.push('/login')
  }

  const markAllAsRead = async () => {
    if (!user) return

    // Update last_read_at for all rooms
    const { data: rooms } = await supabase
      .from('chat_participants')
      .select('room_id')
      .eq('user_id', user.id)

    if (rooms) {
      for (const room of rooms) {
        await supabase
          .from('chat_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('room_id', room.room_id)
          .eq('user_id', user.id)
      }
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const handleNotificationClick = (notification: Notification) => {
    if (notification.link) {
      router.push(notification.link)
    }
    setShowNotifications(false)
  }

  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator'
      case 'saelger':
        return 'Sælger'
      case 'bureau':
        return 'Bureau'
      default:
        return role
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Lige nu'
    if (diffMins < 60) return `${diffMins} min siden`
    if (diffHours < 24) return `${diffHours} timer siden`
    return `${diffDays} dage siden`
  }

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left Side */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Search */}
          <div className="hidden md:flex items-center" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Søg kunder, leads, brugere..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                className="w-80 pl-10 pr-10 py-2 text-sm rounded-lg border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-input text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSearchResults([])
                    setShowSearchResults(false)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Search Results Dropdown */}
              {showSearchResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border shadow-lg z-50 max-h-96 overflow-y-auto">
                  {isSearching ? (
                    <div className="px-4 py-8 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                      <span className="ml-2 text-sm text-gray-500">Søger...</span>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Ingen resultater fundet for "{searchQuery}"
                    </div>
                  ) : (
                    <div className="py-2">
                      {searchResults.map((result) => (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleSearchResultClick(result)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-input flex items-center justify-center flex-shrink-0">
                            {getSearchIcon(result.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {result.title}
                            </p>
                            {result.subtitle && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {result.subtitle}
                              </p>
                            )}
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-dark-input text-gray-600 dark:text-gray-400">
                            {getSearchTypeLabel(result.type)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3" ref={dropdownRef}>
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications)
                setShowDropdown(false)
              }}
              className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border shadow-lg z-50">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Notifikationer</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    >
                      Marker alle som læst
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      Ingen nye notifikationer
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors text-left ${
                          !notification.read ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          notification.type === 'chat'
                            ? 'bg-blue-100 dark:bg-blue-900/30'
                            : 'bg-green-100 dark:bg-green-900/30'
                        }`}>
                          {notification.type === 'chat' ? (
                            <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {formatTimeAgo(notification.created_at)}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0 mt-2" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowDropdown(!showDropdown)
                setShowNotifications(false)
              }}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white text-sm font-medium">
                    {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.full_name || 'Bruger'}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.role ? getRoleName(user.role) : ''}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 hidden md:block" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border shadow-lg z-50">
                <Link
                  href="/indstillinger"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
                  onClick={() => setShowDropdown(false)}
                >
                  <Settings className="w-4 h-4" />
                  Indstillinger
                </Link>
                <hr className="my-1 border-gray-200 dark:border-dark-border" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-danger-light hover:text-danger w-full hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Log ud
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

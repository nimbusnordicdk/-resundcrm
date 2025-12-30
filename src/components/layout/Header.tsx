'use client'

import { useState, useRef, useEffect } from 'react'
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
  Command,
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

interface HeaderProps {
  user: User | null
  onMenuClick: () => void
}

export default function Header({ user, onMenuClick }: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left Side */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Search Trigger - Opens Command Palette */}
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
            }}
            className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all group"
          >
            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-400 w-48 text-left">Søg...</span>
            <kbd className="flex items-center gap-0.5 px-2 py-0.5 bg-white dark:bg-white/5 rounded text-xs text-gray-500 dark:text-gray-600 border border-gray-200 dark:border-white/10">
              <Command className="w-3 h-3" />
              K
            </kbd>
          </button>
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
              className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary-500 rounded-full border-2 border-white dark:border-slate-900" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900/95 backdrop-blur-xl rounded-xl border border-gray-200 dark:border-white/10 shadow-2xl z-50">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Notifikationer</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
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
                        className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left ${
                          !notification.read ? 'bg-primary-50 dark:bg-primary-500/10' : ''
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          notification.type === 'chat'
                            ? 'bg-blue-100 dark:bg-blue-500/20'
                            : 'bg-green-100 dark:bg-green-500/20'
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
                          <div className="w-2 h-2 bg-primary-500 dark:bg-primary-400 rounded-full flex-shrink-0 mt-2" />
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
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-gradient-to-br dark:from-primary-500/20 dark:to-primary-600/10 flex items-center justify-center border border-primary-200 dark:border-white/10">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="w-full h-full rounded-lg object-cover"
                  />
                ) : (
                  <span className="text-primary-600 dark:text-primary-400 text-sm font-semibold">
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
              <ChevronDown className="w-4 h-4 text-gray-500 hidden md:block" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900/95 backdrop-blur-xl rounded-xl border border-gray-200 dark:border-white/10 shadow-2xl z-50 overflow-hidden">
                <Link
                  href="/indstillinger"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors"
                  onClick={() => setShowDropdown(false)}
                >
                  <Settings className="w-4 h-4" />
                  Indstillinger
                </Link>
                <hr className="border-gray-200 dark:border-white/10" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 w-full hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
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

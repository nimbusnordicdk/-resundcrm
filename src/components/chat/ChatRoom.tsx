'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Plus, Users, Archive, ArchiveRestore } from 'lucide-react'
import { Button, Modal, ModalFooter, Input } from '@/components/ui'
import toast from 'react-hot-toast'
import type { ChatRoom, User } from '@/types/database'

interface ChatRoomProps {
  userId: string
  userRole: 'admin' | 'saelger' | 'bureau'
}

export function ChatComponent({ userId, userRole }: ChatRoomProps) {
  const [rooms, setRooms] = useState<any[]>([])
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [chatName, setChatName] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchRooms()
    fetchUsers()
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom.id)

      // Cleanup previous subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }

      // Subscribe to new messages
      const channel = supabase
        .channel(`room-${selectedRoom.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `room_id=eq.${selectedRoom.id}`,
          },
          async (payload) => {
            // Hent sender info
            const { data: sender } = await supabase
              .from('users')
              .select('id, full_name, avatar_url')
              .eq('id', payload.new.sender_id)
              .single()

            setMessages((prev) => {
              // Undgå duplicates
              if (prev.some(m => m.id === payload.new.id)) {
                return prev
              }
              return [...prev, { ...payload.new, sender }]
            })
          }
        )
        .subscribe()

      channelRef.current = channel
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [selectedRoom?.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function fetchCurrentUser() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    setCurrentUser(data)
  }

  async function fetchRooms() {
    // Hent rum hvor brugeren er deltager
    const { data: participantRooms } = await supabase
      .from('chat_participants')
      .select('room_id')
      .eq('user_id', userId)

    const roomIds = participantRooms?.map((p) => p.room_id) || []

    let query = supabase
      .from('chat_rooms')
      .select(`
        *,
        participants:chat_participants(
          user:users(id, full_name, avatar_url)
        )
      `)
      .order('updated_at', { ascending: false })

    // Byg filter baseret på om der er room IDs
    // Bureauer kan IKKE se team chat (kun sælgere og admin)
    if (userRole === 'bureau') {
      // Bureauer ser kun deres egne chats, ikke team chat
      if (roomIds.length > 0) {
        query = query.in('id', roomIds)
      } else {
        // Ingen chats for denne bureau endnu
        setRooms([])
        setLoading(false)
        return
      }
    } else {
      // Admin og sælgere kan se team chat + deres egne chats
      if (roomIds.length > 0) {
        query = query.or(`id.in.(${roomIds.join(',')}),is_team_chat.eq.true`)
      } else {
        query = query.eq('is_team_chat', true)
      }
    }

    const { data: rooms } = await query

    setRooms(rooms || [])

    // Auto-select team chat if exists
    const teamChat = rooms?.find((r) => r.is_team_chat)
    if (teamChat && !selectedRoom) {
      setSelectedRoom(teamChat)
    }

    setLoading(false)
  }

  async function fetchUsers() {
    let query = supabase.from('users').select('*')

    // Bureau kan kun chatte med Øresund team
    if (userRole === 'bureau') {
      query = query.in('role', ['admin', 'saelger'])
    }

    const { data } = await query.neq('id', userId)
    setUsers(data || [])
  }

  async function fetchMessages(roomId: string) {
    const { data } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:users(id, full_name, avatar_url)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })

    setMessages(data || [])
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedRoom) return

    const messageContent = newMessage.trim()
    setNewMessage('')

    const { error } = await supabase.from('chat_messages').insert({
      room_id: selectedRoom.id,
      sender_id: userId,
      content: messageContent,
    })

    if (error) {
      console.error('Send message error:', error)
      toast.error('Kunne ikke sende besked')
      setNewMessage(messageContent) // Restore message on error
    }
  }

  async function createChat() {
    if (selectedUsers.length === 0) {
      toast.error('Vælg mindst én deltager')
      return
    }

    try {
      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({
          name: chatName || null,
          is_group: selectedUsers.length > 1,
          is_team_chat: false,
          created_by: userId,
        })
        .select()
        .single()

      if (roomError) {
        console.error('Room create error:', roomError)
        throw roomError
      }

      // Tilføj deltagere en ad gangen for at undgå RLS issues
      for (const participantId of [userId, ...selectedUsers]) {
        const { error: participantError } = await supabase
          .from('chat_participants')
          .insert({
            room_id: room.id,
            user_id: participantId,
          })

        if (participantError) {
          console.error('Participant insert error:', participantError)
          // Continue anyway - might be duplicate
        }
      }

      toast.success('Chat oprettet!')
      setShowNewChatModal(false)
      setChatName('')
      setSelectedUsers([])
      await fetchRooms()
      setSelectedRoom(room)
    } catch (error: any) {
      console.error('Create chat error:', error)
      toast.error(error?.message || 'Kunne ikke oprette chat')
    }
  }

  async function toggleArchive(roomId: string, currentArchived: boolean) {
    const { error } = await supabase
      .from('chat_rooms')
      .update({ is_archived: !currentArchived })
      .eq('id', roomId)

    if (error) {
      console.error('Archive error:', error)
      toast.error('Kunne ikke arkivere chat')
      return
    }

    toast.success(currentArchived ? 'Chat genoprettet' : 'Chat arkiveret')
    await fetchRooms()

    if (!currentArchived) {
      setSelectedRoom(null)
    }
  }

  function getRoomName(room: any) {
    if (room.is_team_chat) return 'Øresund Team'
    if (room.name) return room.name
    const otherParticipants = room.participants
      ?.filter((p: any) => p.user?.id !== userId)
      .map((p: any) => p.user?.full_name)
      .join(', ')
    return otherParticipants || 'Chat'
  }

  // Filter rooms based on archive status
  const filteredRooms = rooms.filter((room) => {
    // Team chat should always be visible in active chats
    if (room.is_team_chat) return !showArchived
    return showArchived ? room.is_archived : !room.is_archived
  })

  const archivedCount = rooms.filter((r) => r.is_archived && !r.is_team_chat).length

  function formatTime(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Rooms Sidebar */}
      <div className="w-80 flex-shrink-0 card flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Chats</h2>
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowNewChatModal(true)}
          />
        </div>

        {/* Archive Tabs */}
        <div className="flex border-b border-gray-200 dark:border-dark-border">
          <button
            onClick={() => setShowArchived(false)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              !showArchived
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Aktive
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
              showArchived
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Arkiveret
            {archivedCount > 0 && (
              <span className="bg-gray-200 dark:bg-dark-hover text-gray-600 dark:text-gray-400 text-xs px-1.5 py-0.5 rounded-full">
                {archivedCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              {showArchived ? 'Ingen arkiverede chats' : 'Ingen aktive chats'}
            </div>
          ) : (
            filteredRooms.map((room) => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              className={`w-full p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors text-left ${
                selectedRoom?.id === room.id ? 'bg-gray-100 dark:bg-dark-hover' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                {room.is_team_chat ? (
                  <Users className="w-5 h-5 text-white" />
                ) : (
                  <span className="text-white font-medium">
                    {getRoomName(room).charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{getRoomName(room)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {room.is_team_chat
                    ? 'Alle medarbejdere'
                    : room.participants
                        ?.map((p: any) => p.user?.full_name)
                        .filter(Boolean)
                        .join(', ') || 'Ingen deltagere'
                  }
                </p>
              </div>
            </button>
          ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 card flex flex-col overflow-hidden">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 dark:border-dark-border flex-shrink-0 flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">{getRoomName(selectedRoom)}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedRoom.is_team_chat
                    ? 'Alle medarbejdere'
                    : (selectedRoom as any).participants
                        ?.map((p: any) => p.user?.full_name)
                        .filter(Boolean)
                        .join(', ') || 'Ingen deltagere'
                  }
                </p>
              </div>
              {!selectedRoom.is_team_chat && (
                <button
                  onClick={() => toggleArchive(selectedRoom.id, (selectedRoom as any).is_archived || false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors text-gray-500 dark:text-gray-400"
                  title={(selectedRoom as any).is_archived ? 'Genopret chat' : 'Arkiver chat'}
                >
                  {(selectedRoom as any).is_archived ? (
                    <ArchiveRestore className="w-5 h-5" />
                  ) : (
                    <Archive className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Ingen beskeder endnu. Start samtalen!
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message, index) => {
                    const isOwn = message.sender_id === userId
                    const prevMessage = index > 0 ? messages[index - 1] : null
                    const showSender = !prevMessage || prevMessage.sender_id !== message.sender_id

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex gap-2 max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                          {/* Avatar for andre */}
                          {!isOwn && showSender && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-dark-hover flex items-center justify-center flex-shrink-0 self-end">
                              {message.sender?.avatar_url ? (
                                <img
                                  src={message.sender.avatar_url}
                                  alt=""
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                  {message.sender?.full_name?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                              )}
                            </div>
                          )}
                          {!isOwn && !showSender && <div className="w-8 flex-shrink-0" />}

                          <div className="flex flex-col">
                            {/* Sender name */}
                            {!isOwn && showSender && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">
                                {message.sender?.full_name || 'Ukendt'}
                              </span>
                            )}

                            {/* Message bubble */}
                            <div
                              className={`px-4 py-2 rounded-2xl break-words ${
                                isOwn
                                  ? 'bg-primary-600 text-white rounded-br-md'
                                  : 'bg-gray-100 dark:bg-dark-hover text-gray-900 dark:text-gray-100 rounded-bl-md'
                              }`}
                            >
                              {message.content}
                            </div>

                            {/* Time */}
                            <span className={`text-xs text-gray-400 mt-1 ${isOwn ? 'text-right mr-1' : 'ml-1'}`}>
                              {formatTime(message.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 dark:border-dark-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Skriv en besked..."
                  className="input flex-1"
                />
                <Button type="submit" icon={<Send className="w-4 h-4" />}>
                  Send
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Vælg en chat for at starte
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <Modal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        title="Ny Chat"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Chat Navn (valgfrit)"
            value={chatName}
            onChange={(e) => setChatName(e.target.value)}
            placeholder="Gruppechat navn..."
          />

          <div>
            <label className="label">Vælg Deltagere</label>
            <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-200 dark:border-dark-border rounded-lg p-2">
              {users.length === 0 ? (
                <p className="text-sm text-gray-500 p-2">Ingen brugere fundet</p>
              ) : (
                users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers([...selectedUsers, user.id])
                        } else {
                          setSelectedUsers(selectedUsers.filter((id) => id !== user.id))
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 dark:border-dark-border"
                    />
                    <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                      <span className="text-white text-sm">
                        {user.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-gray-900 dark:text-white">{user.full_name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowNewChatModal(false)}>
            Annuller
          </Button>
          <Button onClick={createChat} disabled={selectedUsers.length === 0}>
            Opret Chat
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

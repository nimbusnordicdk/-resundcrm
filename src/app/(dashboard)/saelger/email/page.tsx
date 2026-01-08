'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  Button,
  Input,
  Modal,
  ModalFooter,
} from '@/components/ui'
import { WYSIWYGEditor } from '@/components/forms/WYSIWYGEditor'
import {
  Mail,
  Inbox,
  Send,
  Trash2,
  Star,
  RefreshCw,
  Plus,
  Search,
  Paperclip,
  MoreVertical,
  ChevronLeft,
  Settings,
  Check,
  X,
  Eye,
  EyeOff,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Email {
  id: string
  from_email: string
  from_name: string
  to_email: string
  subject: string
  body: string
  is_read: boolean
  is_starred: boolean
  is_sent: boolean
  created_at: string
}

interface SmtpSettings {
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  imap_host: string
  imap_port: number
  imap_user: string
  imap_password: string
  from_name: string
  from_email: string
  signature: string
}

export default function EmailPage() {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'starred' | 'trash'>('inbox')
  const [searchTerm, setSearchTerm] = useState('')
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [smtpConfigured, setSmtpConfigured] = useState(false)

  const [composeData, setComposeData] = useState({
    to: '',
    subject: '',
    body: '',
  })

  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    imap_host: '',
    imap_port: 993,
    imap_user: '',
    imap_password: '',
    from_name: '',
    from_email: '',
    signature: '',
  })
  const [showImapPassword, setShowImapPassword] = useState(false)

  const [sending, setSending] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [fetchingMails, setFetchingMails] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchUserAndEmails()
  }, [])

  useEffect(() => {
    if (userId) {
      fetchEmails()
    }
  }, [activeFolder, userId])

  async function fetchUserAndEmails() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUserId(user.id)

    // Fetch SMTP settings
    const { data: settings } = await supabase
      .from('user_email_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (settings) {
      setSmtpSettings({
        smtp_host: settings.smtp_host || '',
        smtp_port: settings.smtp_port || 587,
        smtp_user: settings.smtp_user || '',
        smtp_password: settings.smtp_password || '',
        imap_host: settings.imap_host || '',
        imap_port: settings.imap_port || 993,
        imap_user: settings.imap_user || '',
        imap_password: settings.imap_password || '',
        from_name: settings.from_name || '',
        from_email: settings.from_email || '',
        signature: settings.signature || '',
      })
      setSmtpConfigured(!!settings.smtp_host && !!settings.smtp_user)
    }

    fetchEmails()
  }

  async function fetchEmails() {
    if (!userId) return

    let query = supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (activeFolder === 'inbox') {
      query = query.eq('is_sent', false).eq('is_deleted', false)
    } else if (activeFolder === 'sent') {
      query = query.eq('is_sent', true).eq('is_deleted', false)
    } else if (activeFolder === 'starred') {
      query = query.eq('is_starred', true).eq('is_deleted', false)
    } else if (activeFolder === 'trash') {
      query = query.eq('is_deleted', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching emails:', error)
    } else {
      setEmails(data || [])
    }
    setLoading(false)
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    setSavingSettings(true)

    try {
      const { error } = await supabase
        .from('user_email_settings')
        .upsert(
          {
            user_id: userId,
            ...smtpSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )

      if (error) throw error

      setSmtpConfigured(true)
      toast.success('Email indstillinger gemt!')
      setShowSettingsModal(false)
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke gemme indstillinger')
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeData.to,
          subject: composeData.subject,
          body: composeData.body,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunne ikke sende email')
      }

      toast.success('Email sendt!')
      setShowComposeModal(false)
      setComposeData({ to: '', subject: '', body: '' })
      fetchEmails()
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke sende email')
    } finally {
      setSending(false)
    }
  }

  async function toggleStar(email: Email) {
    const { error } = await supabase
      .from('emails')
      .update({ is_starred: !email.is_starred })
      .eq('id', email.id)

    if (!error) {
      setEmails(emails.map(e => e.id === email.id ? { ...e, is_starred: !e.is_starred } : e))
    }
  }

  async function markAsRead(email: Email) {
    if (email.is_read) return

    const { error } = await supabase
      .from('emails')
      .update({ is_read: true })
      .eq('id', email.id)

    if (!error) {
      setEmails(emails.map(e => e.id === email.id ? { ...e, is_read: true } : e))
    }
  }

  async function deleteEmail(email: Email) {
    const { error } = await supabase
      .from('emails')
      .update({ is_deleted: true })
      .eq('id', email.id)

    if (!error) {
      toast.success('Email slettet')
      setSelectedEmail(null)
      fetchEmails()
    }
  }

  async function fetchInboxEmails() {
    if (!smtpSettings.imap_host || !smtpSettings.imap_user) {
      toast.error('Konfigurer IMAP indstillinger først')
      return
    }

    setFetchingMails(true)
    try {
      const response = await fetch('/api/email/fetch', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunne ikke hente emails')
      }

      toast.success(data.message)
      fetchEmails()
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke hente emails')
    } finally {
      setFetchingMails(false)
    }
  }

  const filteredEmails = emails.filter(email =>
    email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.from_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.from_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const unreadCount = emails.filter(e => !e.is_read && !e.is_sent).length

  const folders = [
    { id: 'inbox', label: 'Indbakke', icon: Inbox, count: unreadCount },
    { id: 'sent', label: 'Sendt', icon: Send },
    { id: 'starred', label: 'Stjernemarkeret', icon: Star },
    { id: 'trash', label: 'Papirkurv', icon: Trash2 },
  ]

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Send og modtag emails</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<RefreshCw className={`w-4 h-4 ${fetchingMails ? 'animate-spin' : ''}`} />}
            onClick={fetchInboxEmails}
            disabled={!smtpConfigured || fetchingMails}
          >
            {fetchingMails ? 'Henter...' : 'Hent Mail'}
          </Button>
          <Button
            variant="secondary"
            icon={<Settings className="w-4 h-4" />}
            onClick={() => setShowSettingsModal(true)}
          >
            Indstillinger
          </Button>
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              // Start med signatur hvis den findes
              const initialBody = smtpSettings.signature
                ? `<p><br></p><p><br></p>${smtpSettings.signature}`
                : ''
              setComposeData({ to: '', subject: '', body: initialBody })
              setShowComposeModal(true)
            }}
            disabled={!smtpConfigured}
          >
            Ny Email
          </Button>
        </div>
      </div>

      {!smtpConfigured ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Konfigurer din email
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              For at sende og modtage emails skal du først konfigurere dine SMTP/IMAP indstillinger.
            </p>
            <Button onClick={() => setShowSettingsModal(true)}>
              Konfigurer Email
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-6 h-full">
          {/* Sidebar */}
          <div className="w-56 flex-shrink-0">
            <Card className="h-full">
              <CardContent className="p-3">
                <div className="space-y-1">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => {
                        setActiveFolder(folder.id as any)
                        setSelectedEmail(null)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeFolder === folder.id
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <folder.icon className="w-4 h-4" />
                        <span>{folder.label}</span>
                      </div>
                      {folder.count && folder.count > 0 && (
                        <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {folder.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Email List */}
          <div className="w-80 flex-shrink-0">
            <Card className="h-full flex flex-col">
              <div className="p-3 border-b border-gray-200 dark:border-dark-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Søg i emails..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-10 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                  </div>
                ) : filteredEmails.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Ingen emails</p>
                  </div>
                ) : (
                  filteredEmails.map((email) => (
                    <button
                      key={email.id}
                      onClick={() => {
                        setSelectedEmail(email)
                        markAsRead(email)
                      }}
                      className={`w-full text-left p-3 border-b border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors ${
                        selectedEmail?.id === email.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      } ${!email.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleStar(email)
                          }}
                          className="mt-0.5"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              email.is_starred
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                          />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm truncate ${!email.is_read ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                              {email.is_sent ? email.to_email : email.from_name || email.from_email}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2">
                              {new Date(email.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <p className={`text-sm truncate ${!email.is_read ? 'font-medium text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}`}>
                            {email.subject || '(Ingen emne)'}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                            {email.body.substring(0, 60)}...
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Email Detail */}
          <Card className="flex-1 flex flex-col">
            {selectedEmail ? (
              <>
                <div className="p-4 border-b border-gray-200 dark:border-dark-border">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedEmail(null)}
                      className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setComposeData({
                            to: selectedEmail.from_email,
                            subject: `Re: ${selectedEmail.subject}`,
                            body: `\n\n---\nFra: ${selectedEmail.from_name} <${selectedEmail.from_email}>\nDato: ${new Date(selectedEmail.created_at).toLocaleString('da-DK')}\n\n${selectedEmail.body}`,
                          })
                          setShowComposeModal(true)
                        }}
                      >
                        Svar
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Trash2 className="w-4 h-4" />}
                        onClick={() => deleteEmail(selectedEmail)}
                      >
                        Slet
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    {selectedEmail.subject || '(Ingen emne)'}
                  </h2>

                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-dark-border">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <span className="text-primary-600 dark:text-primary-400 font-medium">
                        {(selectedEmail.from_name || selectedEmail.from_email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedEmail.from_name || selectedEmail.from_email}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedEmail.from_email} • {new Date(selectedEmail.created_at).toLocaleString('da-DK')}
                      </p>
                    </div>
                  </div>

                  <div className="prose dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                      {selectedEmail.body}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
                <div className="text-center">
                  <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Vælg en email for at læse den</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Compose Modal */}
      <Modal
        isOpen={showComposeModal}
        onClose={() => setShowComposeModal(false)}
        title="Ny Email"
        size="lg"
      >
        <form onSubmit={handleSendEmail} className="space-y-4">
          <Input
            label="Til"
            type="email"
            value={composeData.to}
            onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
            required
            placeholder="modtager@example.com"
          />

          <Input
            label="Emne"
            value={composeData.subject}
            onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
            required
            placeholder="Skriv emne..."
          />

          <div>
            <label className="label">Besked</label>
            <WYSIWYGEditor
              content={composeData.body}
              onChange={(body) => setComposeData({ ...composeData, body })}
              placeholder="Skriv din besked..."
              minHeight="250px"
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowComposeModal(false)}
            >
              Annuller
            </Button>
            <Button type="submit" loading={sending} icon={<Send className="w-4 h-4" />}>
              Send
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Email Indstillinger"
        size="lg"
      >
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Afsender Info
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Dit navn"
                value={smtpSettings.from_name}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, from_name: e.target.value })}
                required
                placeholder="Dit Navn"
              />
              <Input
                label="Din email"
                type="email"
                value={smtpSettings.from_email}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, from_email: e.target.value })}
                required
                placeholder="din@email.dk"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              SMTP (Udgående mail)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="SMTP Server"
                value={smtpSettings.smtp_host}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_host: e.target.value })}
                required
                placeholder="smtp.gmail.com"
              />
              <Input
                label="SMTP Port"
                type="number"
                value={smtpSettings.smtp_port}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_port: parseInt(e.target.value) })}
                required
                placeholder="587"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Brugernavn"
                value={smtpSettings.smtp_user}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_user: e.target.value })}
                required
                placeholder="din@email.dk"
              />
              <div className="relative">
                <Input
                  label="Adgangskode"
                  type={showPassword ? 'text' : 'password'}
                  value={smtpSettings.smtp_password}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_password: e.target.value })}
                  required
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              IMAP / POP3 (Indgående mail)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="IMAP/POP3 Server"
                value={smtpSettings.imap_host}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, imap_host: e.target.value })}
                placeholder="mail.simply.com"
              />
              <Input
                label="Port"
                type="number"
                value={smtpSettings.imap_port}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, imap_port: parseInt(e.target.value) })}
                placeholder="143"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Brugernavn (email)"
                value={smtpSettings.imap_user}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, imap_user: e.target.value })}
                placeholder="din@email.dk"
              />
              <div className="relative">
                <Input
                  label="Adgangskode"
                  type={showImapPassword ? 'text' : 'password'}
                  value={smtpSettings.imap_password}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, imap_password: e.target.value })}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowImapPassword(!showImapPassword)}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                >
                  {showImapPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Email Signatur
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Din signatur tilføjes automatisk til bunden af alle dine emails.
            </p>
            <WYSIWYGEditor
              content={smtpSettings.signature}
              onChange={(signature) => setSmtpSettings({ ...smtpSettings, signature })}
              placeholder="Skriv din email signatur her..."
              minHeight="150px"
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowSettingsModal(false)}
            >
              Annuller
            </Button>
            <Button type="submit" loading={savingSettings}>
              Gem Indstillinger
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  )
}

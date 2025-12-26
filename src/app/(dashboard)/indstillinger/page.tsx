'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, Button, Input } from '@/components/ui'
import {
  User,
  Lock,
  Bell,
  Palette,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react'
import type { User as UserType } from '@/types/database'
import toast from 'react-hot-toast'

type TabType = 'profil' | 'sikkerhed' | 'notifikationer' | 'udseende'

export default function IndstillingerPage() {
  const [activeTab, setActiveTab] = useState<TabType>('profil')
  const [user, setUser] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Profile form
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Notifications
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [chatNotifications, setChatNotifications] = useState(true)
  const [meetingReminders, setMeetingReminders] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function fetchUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (data) {
          setUser(data)
          setFullName(data.full_name || '')
          setPhone(data.phone || '')
        }
      }
      setLoading(false)
    }

    fetchUser()
  }, [])

  const handleSaveProfile = async () => {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: fullName,
          phone: phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      setUser({ ...user, full_name: fullName, phone: phone })
      toast.success('Profil opdateret')
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Kunne ikke opdatere profil')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Adgangskoderne matcher ikke')
      return
    }

    if (newPassword.length < 6) {
      toast.error('Adgangskoden skal være mindst 6 tegn')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Adgangskode ændret')
    } catch (error) {
      console.error('Error changing password:', error)
      toast.error('Kunne ikke ændre adgangskode')
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'profil' as TabType, label: 'Profil', icon: User },
    { id: 'sikkerhed' as TabType, label: 'Sikkerhed', icon: Lock },
    { id: 'notifikationer' as TabType, label: 'Notifikationer', icon: Bell },
    { id: 'udseende' as TabType, label: 'Udseende', icon: Palette },
  ]

  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator'
      case 'saelger': return 'Sælger'
      case 'bureau': return 'Bureau'
      default: return role
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Indstillinger</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Administrer din konto og præferencer</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {/* Profil Tab */}
          {activeTab === 'profil' && (
            <Card>
              <div className="p-6 border-b border-gray-200 dark:border-dark-border">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profiloplysninger</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Opdater dine personlige oplysninger
                </p>
              </div>
              <div className="p-6 space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-primary-600 flex items-center justify-center">
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-2xl font-bold">
                        {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{user?.full_name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user?.role ? getRoleName(user.role) : ''}</p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Fulde navn"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dit fulde navn"
                  />
                  <Input
                    label="Email"
                    value={user?.email || ''}
                    disabled
                    helperText="Email kan ikke ændres"
                  />
                  <Input
                    label="Telefon"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+45 12 34 56 78"
                  />
                  <Input
                    label="Rolle"
                    value={user?.role ? getRoleName(user.role) : ''}
                    disabled
                    helperText="Kontakt administrator for at ændre rolle"
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} loading={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    Gem ændringer
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Sikkerhed Tab */}
          {activeTab === 'sikkerhed' && (
            <Card>
              <div className="p-6 border-b border-gray-200 dark:border-dark-border">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sikkerhed</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Administrer din adgangskode og sikkerhedsindstillinger
                </p>
              </div>
              <div className="p-6 space-y-6">
                <h3 className="font-medium text-gray-900 dark:text-white">Skift adgangskode</h3>

                <div className="space-y-4 max-w-md">
                  <div className="relative">
                    <Input
                      label="Nuværende adgangskode"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <Input
                      label="Ny adgangskode"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      helperText="Mindst 6 tegn"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <Input
                      label="Bekræft ny adgangskode"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleChangePassword}
                    loading={saving}
                    disabled={!newPassword || !confirmPassword}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Skift adgangskode
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Notifikationer Tab */}
          {activeTab === 'notifikationer' && (
            <Card>
              <div className="p-6 border-b border-gray-200 dark:border-dark-border">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notifikationer</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Vælg hvilke notifikationer du vil modtage
                </p>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-input rounded-lg cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Email-notifikationer</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Modtag vigtige opdateringer via email</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailNotifications}
                      onChange={(e) => setEmailNotifications(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-input rounded-lg cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Chat-notifikationer</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Få besked når du modtager nye beskeder</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={chatNotifications}
                      onChange={(e) => setChatNotifications(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-input rounded-lg cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Møde-påmindelser</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Få påmindelser før dine møder</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={meetingReminders}
                      onChange={(e) => setMeetingReminders(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </label>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Notifikationsindstillinger gemmes automatisk.
                </p>
              </div>
            </Card>
          )}

          {/* Udseende Tab */}
          {activeTab === 'udseende' && (
            <Card>
              <div className="p-6 border-b border-gray-200 dark:border-dark-border">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Udseende</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Tilpas udseendet af applikationen
                </p>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Tema</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      onClick={() => {
                        document.documentElement.classList.remove('dark')
                        localStorage.setItem('theme', 'light')
                      }}
                      className="p-4 border-2 rounded-lg transition-colors hover:border-primary-500 bg-white border-gray-200"
                    >
                      <div className="w-full h-20 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                        <div className="w-8 h-8 bg-white rounded shadow"></div>
                      </div>
                      <p className="font-medium text-gray-900">Lyst</p>
                    </button>

                    <button
                      onClick={() => {
                        document.documentElement.classList.add('dark')
                        localStorage.setItem('theme', 'dark')
                      }}
                      className="p-4 border-2 rounded-lg transition-colors hover:border-primary-500 bg-gray-800 border-gray-700"
                    >
                      <div className="w-full h-20 bg-gray-900 rounded-lg mb-3 flex items-center justify-center">
                        <div className="w-8 h-8 bg-gray-700 rounded shadow"></div>
                      </div>
                      <p className="font-medium text-white">Mørkt</p>
                    </button>

                    <button
                      onClick={() => {
                        localStorage.setItem('theme', 'system')
                        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                          document.documentElement.classList.add('dark')
                        } else {
                          document.documentElement.classList.remove('dark')
                        }
                      }}
                      className="p-4 border-2 rounded-lg transition-colors hover:border-primary-500 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white to-gray-800"
                    >
                      <div className="w-full h-20 bg-gradient-to-br from-gray-100 to-gray-800 rounded-lg mb-3 flex items-center justify-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-white to-gray-600 rounded shadow"></div>
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white">System</p>
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

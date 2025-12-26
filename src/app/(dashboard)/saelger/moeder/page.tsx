'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  Button,
  Modal,
  ModalFooter,
  Input,
  TextArea,
} from '@/components/ui'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Video,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Meeting } from '@/types/database'

export default function MoederPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    google_meet_link: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchMeetings()
  }, [currentDate])

  async function fetchMeetings() {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('saelger_id', user?.id)
      .gte('date', startOfMonth.toISOString().split('T')[0])
      .lte('date', endOfMonth.toISOString().split('T')[0])
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    if (!error) {
      setMeetings(data || [])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase.from('meetings').insert({
        title: formData.title,
        description: formData.description || null,
        date: formData.date,
        time: formData.time,
        google_meet_link: formData.google_meet_link || null,
        saelger_id: user?.id,
      })

      if (error) throw error

      toast.success('Møde oprettet!')
      setShowModal(false)
      setFormData({
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        google_meet_link: '',
      })
      fetchMeetings()
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke oprette møde')
    } finally {
      setSubmitting(false)
    }
  }

  function prevMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  function getDaysInMonth() {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days = []

    // Add empty days for start of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null)
    }

    // Add days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(i)
    }

    return days
  }

  function getMeetingsForDay(day: number) {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return meetings.filter((m) => m.date === dateStr)
  }

  const monthNames = [
    'Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'December'
  ]

  const dayNames = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']
  const today = new Date()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Møder</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Administrer dine møder</p>
        </div>
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowModal(true)}
        >
          Opret Møde
        </Button>
      </div>

      {/* Calendar */}
      <Card>
        {/* Calendar Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-gray-500 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {getDaysInMonth().map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="h-24" />
              }

              const dayMeetings = getMeetingsForDay(day)
              const isToday =
                day === today.getDate() &&
                currentDate.getMonth() === today.getMonth() &&
                currentDate.getFullYear() === today.getFullYear()

              return (
                <div
                  key={day}
                  className={`h-24 p-2 rounded-lg border ${
                    isToday
                      ? 'border-primary-500 bg-primary-600/10'
                      : 'border-gray-200 dark:border-dark-border'
                  } hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors`}
                >
                  <span
                    className={`text-sm font-medium ${
                      isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-1 overflow-hidden">
                    {dayMeetings.slice(0, 2).map((meeting) => (
                      <div
                        key={meeting.id}
                        className="text-xs p-1 rounded bg-primary-600/20 text-primary-600 dark:text-primary-400 truncate"
                        title={meeting.title}
                      >
                        {meeting.time.slice(0, 5)} {meeting.title}
                      </div>
                    ))}
                    {dayMeetings.length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{dayMeetings.length - 2} mere
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Upcoming Meetings List */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kommende Møder</h2>
        </div>
        <CardContent>
          {meetings.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Ingen møder denne måned
            </p>
          ) : (
            <div className="space-y-3">
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-gray-100 dark:bg-dark-hover"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary-600/20 flex items-center justify-center">
                      <CalendarIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{meeting.title}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          {new Date(meeting.date).toLocaleDateString('da-DK')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {meeting.time.slice(0, 5)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {meeting.google_meet_link && (
                    <a
                      href={meeting.google_meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary btn-sm"
                    >
                      <Video className="w-4 h-4" />
                      Åbn
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Meeting Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Opret Møde"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Møde Navn"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            placeholder="Indtast møde navn"
          />

          <TextArea
            label="Beskrivelse"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Valgfri beskrivelse..."
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Dato"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <Input
              label="Tid"
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              required
            />
          </div>

          <Input
            label="Google Meet Link"
            type="url"
            value={formData.google_meet_link}
            onChange={(e) => setFormData({ ...formData, google_meet_link: e.target.value })}
            placeholder="https://meet.google.com/..."
          />

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
            >
              Annuller
            </Button>
            <Button type="submit" loading={submitting}>
              Opret Møde
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  )
}

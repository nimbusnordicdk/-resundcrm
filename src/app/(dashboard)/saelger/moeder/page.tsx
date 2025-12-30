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
  CheckCircle2,
  XCircle,
  X,
  UserCheck,
  UserX,
  FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Meeting } from '@/types/database'

export default function MoederPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
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
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('fetchMeetings: User error:', userError)
      return
    }

    // Use local date formatting to avoid timezone issues
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('saelger_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    if (error) {
      console.error('fetchMeetings: Query error:', error)
      return
    }

    console.log('fetchMeetings: Found meetings:', data?.length, 'for user:', user.id, 'between', startDate, 'and', endDate)
    setMeetings(data || [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        toast.error('Du skal være logget ind for at oprette møder')
        return
      }

      const { data, error } = await supabase.from('meetings').insert({
        title: formData.title,
        description: formData.description || null,
        date: formData.date,
        time: formData.time,
        google_meet_link: formData.google_meet_link || null,
        saelger_id: user.id,
      }).select()

      if (error) {
        console.error('Meeting insert error:', error)
        throw error
      }

      console.log('Meeting created:', data)
      toast.success('Møde oprettet!')

      // Navigate to the month of the created meeting so it's visible
      const meetingMonth = new Date(formData.date)
      if (meetingMonth.getMonth() !== currentDate.getMonth() ||
          meetingMonth.getFullYear() !== currentDate.getFullYear()) {
        setCurrentDate(new Date(meetingMonth.getFullYear(), meetingMonth.getMonth(), 1))
      } else {
        // Re-fetch meetings after a short delay to ensure DB has committed
        setTimeout(() => {
          fetchMeetings()
        }, 100)
      }

      setShowModal(false)
      setFormData({
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        google_meet_link: '',
      })
    } catch (error: any) {
      console.error('Meeting creation failed:', error)
      toast.error(error.message || 'Kunne ikke oprette møde')
    } finally {
      setSubmitting(false)
    }
  }

  async function updateMeetingStatus(meetingId: string, status: 'show_up' | 'no_show' | 'cancelled') {
    try {
      const updateData: any = {
        attendance_status: status,
      }

      if (status === 'show_up' || status === 'no_show') {
        updateData.attended_at = new Date().toISOString()
      } else if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('id', meetingId)

      if (error) throw error

      toast.success(
        status === 'show_up' ? 'Markeret som afholdt' :
        status === 'no_show' ? 'Markeret som no-show' :
        'Møde aflyst'
      )
      setShowMeetingModal(false)
      setSelectedMeeting(null)
      fetchMeetings()
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke opdatere møde')
    }
  }

  function openMeetingDetails(meeting: Meeting) {
    setSelectedMeeting(meeting)
    setShowMeetingModal(true)
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
    return meetings.filter((m) => {
      // Handle both DATE format (YYYY-MM-DD) and TIMESTAMPTZ format (includes time)
      const meetingDate = m.date.split('T')[0]
      return meetingDate === dateStr
    })
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
                      <button
                        key={meeting.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          openMeetingDetails(meeting)
                        }}
                        className={`w-full text-left text-xs p-1 rounded truncate transition-colors ${
                          meeting.attendance_status === 'cancelled'
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 line-through'
                            : meeting.attendance_status === 'show_up'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : meeting.attendance_status === 'no_show'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            : 'bg-primary-600/20 text-primary-600 dark:text-primary-400 hover:bg-primary-600/30'
                        }`}
                        title={meeting.title}
                      >
                        {meeting.time.slice(0, 5)} {meeting.title}
                      </button>
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
              {meetings.map((meeting) => {
                // Handle date format - could be DATE (YYYY-MM-DD) or include time
                const dateOnly = meeting.date.split('T')[0]

                return (
                  <button
                    key={meeting.id}
                    onClick={() => openMeetingDetails(meeting)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      meeting.attendance_status === 'cancelled'
                        ? 'bg-gray-50 dark:bg-dark-hover/50 border-gray-200 dark:border-dark-border opacity-60'
                        : meeting.attendance_status === 'show_up'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                        : meeting.attendance_status === 'no_show'
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30'
                        : 'bg-gray-100 dark:bg-dark-hover border-transparent hover:bg-gray-200 dark:hover:bg-dark-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          meeting.attendance_status === 'show_up'
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : meeting.attendance_status === 'no_show'
                            ? 'bg-red-100 dark:bg-red-900/30'
                            : meeting.attendance_status === 'cancelled'
                            ? 'bg-gray-200 dark:bg-dark-border'
                            : 'bg-primary-600/20'
                        }`}>
                          {meeting.attendance_status === 'show_up' ? (
                            <UserCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
                          ) : meeting.attendance_status === 'no_show' ? (
                            <UserX className="w-6 h-6 text-red-600 dark:text-red-400" />
                          ) : meeting.attendance_status === 'cancelled' ? (
                            <X className="w-6 h-6 text-gray-400" />
                          ) : (
                            <CalendarIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`font-medium ${
                              meeting.attendance_status === 'cancelled'
                                ? 'text-gray-500 dark:text-gray-400 line-through'
                                : 'text-gray-900 dark:text-white'
                            }`}>
                              {meeting.title}
                            </p>
                            {meeting.attendance_status && meeting.attendance_status !== 'pending' && (
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                meeting.attendance_status === 'show_up'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : meeting.attendance_status === 'no_show'
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                  : 'bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-gray-400'
                              }`}>
                                {meeting.attendance_status === 'show_up' ? 'Afholdt' :
                                 meeting.attendance_status === 'no_show' ? 'No-show' : 'Aflyst'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />
                              {new Date(dateOnly).toLocaleDateString('da-DK')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {meeting.time.slice(0, 5)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Google Meet indicator */}
                      {meeting.google_meet_link && meeting.attendance_status !== 'cancelled' && (
                        <div className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                          <Video className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
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

      {/* Meeting Details Modal */}
      <Modal
        isOpen={showMeetingModal}
        onClose={() => {
          setShowMeetingModal(false)
          setSelectedMeeting(null)
        }}
        title="Mødedetaljer"
        size="md"
      >
        {selectedMeeting && (() => {
          const dateOnly = selectedMeeting.date.split('T')[0]
          const meetingDateTime = new Date(`${dateOnly}T${selectedMeeting.time}`)
          const isPast = meetingDateTime < new Date()
          const canChangeStatus = !selectedMeeting.attendance_status || selectedMeeting.attendance_status === 'pending'

          return (
            <div className="space-y-6">
              {/* Meeting Info */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    selectedMeeting.attendance_status === 'show_up'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : selectedMeeting.attendance_status === 'no_show'
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : selectedMeeting.attendance_status === 'cancelled'
                      ? 'bg-gray-200 dark:bg-dark-border'
                      : 'bg-primary-100 dark:bg-primary-900/30'
                  }`}>
                    {selectedMeeting.attendance_status === 'show_up' ? (
                      <UserCheck className="w-7 h-7 text-green-600 dark:text-green-400" />
                    ) : selectedMeeting.attendance_status === 'no_show' ? (
                      <UserX className="w-7 h-7 text-red-600 dark:text-red-400" />
                    ) : selectedMeeting.attendance_status === 'cancelled' ? (
                      <X className="w-7 h-7 text-gray-400" />
                    ) : (
                      <CalendarIcon className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-xl font-semibold ${
                      selectedMeeting.attendance_status === 'cancelled'
                        ? 'text-gray-500 dark:text-gray-400 line-through'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {selectedMeeting.title}
                    </h3>
                    {selectedMeeting.attendance_status && selectedMeeting.attendance_status !== 'pending' && (
                      <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium ${
                        selectedMeeting.attendance_status === 'show_up'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : selectedMeeting.attendance_status === 'no_show'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-gray-400'
                      }`}>
                        {selectedMeeting.attendance_status === 'show_up' ? 'Afholdt' :
                         selectedMeeting.attendance_status === 'no_show' ? 'No-show' : 'Aflyst'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Date & Time */}
                <div className="flex items-center gap-6 text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5" />
                    <span>{new Date(dateOnly).toLocaleDateString('da-DK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span>{selectedMeeting.time.slice(0, 5)}</span>
                  </div>
                </div>

                {/* Description */}
                {selectedMeeting.description && (
                  <div className="p-4 bg-gray-50 dark:bg-dark-hover rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      <FileText className="w-4 h-4" />
                      Beskrivelse
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">{selectedMeeting.description}</p>
                  </div>
                )}

                {/* Google Meet Link */}
                {selectedMeeting.google_meet_link && selectedMeeting.attendance_status !== 'cancelled' && (
                  <a
                    href={selectedMeeting.google_meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                  >
                    <Video className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    <div className="flex-1">
                      <p className="font-medium text-primary-700 dark:text-primary-400">Åbn Google Meet</p>
                      <p className="text-sm text-primary-600/70 dark:text-primary-400/70 truncate">{selectedMeeting.google_meet_link}</p>
                    </div>
                  </a>
                )}
              </div>

              {/* Actions */}
              {canChangeStatus && (
                <div className="border-t border-gray-200 dark:border-dark-border pt-6">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Marker mødestatus</p>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => updateMeetingStatus(selectedMeeting.id, 'show_up')}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                    >
                      <UserCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">Afholdt</span>
                    </button>
                    <button
                      onClick={() => updateMeetingStatus(selectedMeeting.id, 'no_show')}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <UserX className="w-8 h-8 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-medium text-red-700 dark:text-red-400">No-show</span>
                    </button>
                    <button
                      onClick={() => updateMeetingStatus(selectedMeeting.id, 'cancelled')}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-hover hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
                    >
                      <XCircle className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Aflys møde</span>
                    </button>
                  </div>
                </div>
              )}

              <ModalFooter>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowMeetingModal(false)
                    setSelectedMeeting(null)
                  }}
                >
                  Luk
                </Button>
              </ModalFooter>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}

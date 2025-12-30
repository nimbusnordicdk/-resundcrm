'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  Button,
  Modal,
  ModalFooter,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  LeadStatusBadge,
  Input,
  TextArea,
  Select,
} from '@/components/ui'
import { WYSIWYGEditor } from '@/components/forms/WYSIWYGEditor'
import {
  ArrowLeft,
  Phone,
  Calendar,
  Edit3,
  X,
  Check,
  Search,
  ArrowUpDown,
  LayoutGrid,
  List,
  Mail,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Lead, Campaign, Bureau } from '@/types/database'

const leadStatuses = [
  { value: 'nyt_lead', label: 'Nyt Lead' },
  { value: 'kvalifikationskald_booket', label: 'Kvalifikationskald Booket' },
  { value: 'discoverykald_booket', label: 'Discoverykald Booket' },
  { value: 'salgskald_booket', label: 'Salgskald Booket' },
  { value: 'onboarding_booket', label: 'Onboarding Booket' },
  { value: 'kontrakt_sendt', label: 'Kontrakt Sendt' },
  { value: 'kontrakt_underskrevet', label: 'Kontrakt Underskrevet' },
]

// Status order from new lead to closed/lost
const statusOrder = [
  'nyt_lead',
  'kvalifikationskald_booket',
  'discoverykald_booket',
  'salgskald_booket',
  'onboarding_booket',
  'kontrakt_sendt',
  'kontrakt_underskrevet',
  'lead_tabt',
]

export default function KampagneLeadsPage() {
  const params = useParams()
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showLostModal, setShowLostModal] = useState(false)
  const [showClosedModal, setShowClosedModal] = useState(false)
  const [leadNotes, setLeadNotes] = useState('')
  const [leadStatus, setLeadStatus] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [meetingData, setMeetingData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    google_meet_link: '',
  })
  const [bureaus, setBureaus] = useState<Bureau[]>([])
  const [selectedBureauId, setSelectedBureauId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sortByStatus, setSortByStatus] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  const supabase = createClient()

  useEffect(() => {
    fetchData()
    fetchBureaus()
  }, [params.id])

  async function fetchData() {
    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', params.id)
      .single()

    if (campaignData) {
      setCampaign(campaignData)

      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .eq('campaign_id', params.id)
        .order('created_at', { ascending: false })

      setLeads(leadsData || [])
    }
    setLoading(false)
  }

  async function fetchBureaus() {
    const { data } = await supabase
      .from('bureaus')
      .select('*')
      .order('name')
    setBureaus(data || [])
  }

  function openLeadModal(lead: Lead) {
    setSelectedLead(lead)
    setLeadNotes(lead.notes || '')
    setLeadStatus(lead.status)
    setShowLeadModal(true)
  }

  function openMeetingModal(lead: Lead) {
    setSelectedLead(lead)
    setMeetingData({
      title: `Møde med ${lead.name}`,
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      google_meet_link: '',
    })
    setShowMeetingModal(true)
  }

  async function handleCall(lead: Lead) {
    // Her ville vi integrere med Twilio
    toast.success(`Ringer til ${lead.phone}...`)
    router.push(`/saelger/ring-op?phone=${encodeURIComponent(lead.phone)}&lead_id=${lead.id}`)
  }

  async function saveLeadChanges() {
    if (!selectedLead) return
    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          notes: leadNotes,
          status: leadStatus,
        })
        .eq('id', selectedLead.id)

      if (error) throw error

      toast.success('Lead opdateret!')
      setShowLeadModal(false)
      fetchData()
    } catch (error) {
      toast.error('Kunne ikke opdatere lead')
    } finally {
      setSubmitting(false)
    }
  }

  async function markLeadLost() {
    if (!selectedLead || !lostReason) return
    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          status: 'lead_tabt',
          lost_reason: lostReason,
        })
        .eq('id', selectedLead.id)

      if (error) throw error

      toast.success('Lead markeret som tabt')
      setShowLostModal(false)
      setShowLeadModal(false)
      setLostReason('')
      fetchData()
    } catch (error) {
      toast.error('Kunne ikke opdatere lead')
    } finally {
      setSubmitting(false)
    }
  }

  async function markLeadClosed() {
    if (!selectedLead) return
    if (!selectedBureauId) {
      toast.error('Vælg venligst et bureau')
      return
    }
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Opret kunde med det valgte bureau
      const { error: customerError } = await supabase.from('customers').insert({
        name: selectedLead.name,
        email: selectedLead.email,
        phone: selectedLead.phone,
        bureau_id: selectedBureauId,
        saelger_id: user?.id,
        campaign_id: campaign?.id,
        lead_id: selectedLead.id,
        status: 'afventer_bekraeftelse',
      })

      if (customerError) throw customerError

      // Opdater lead status
      const { error: leadError } = await supabase
        .from('leads')
        .update({ status: 'kontrakt_underskrevet' })
        .eq('id', selectedLead.id)

      if (leadError) throw leadError

      toast.success('Kunde lukket! Afventer bureau bekræftelse.')
      setShowClosedModal(false)
      setShowLeadModal(false)
      setSelectedBureauId('')
      fetchData()
    } catch (error) {
      toast.error('Kunne ikke lukke kunde')
    } finally {
      setSubmitting(false)
    }
  }

  async function createMeeting() {
    if (!selectedLead) return
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase.from('meetings').insert({
        title: meetingData.title,
        date: meetingData.date,
        time: meetingData.time,
        google_meet_link: meetingData.google_meet_link || null,
        saelger_id: user?.id,
        lead_id: selectedLead.id,
      })

      if (error) throw error

      toast.success('Møde booket!')
      setShowMeetingModal(false)
    } catch (error) {
      toast.error('Kunne ikke oprette møde')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredLeads = leads
    .filter(
      (l) =>
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.phone.includes(searchTerm) ||
        l.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortByStatus) return 0
      const aIndex = statusOrder.indexOf(a.status) === -1 ? 999 : statusOrder.indexOf(a.status)
      const bIndex = statusOrder.indexOf(b.status) === -1 ? 999 : statusOrder.indexOf(b.status)
      return aIndex - bIndex
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        icon={<ArrowLeft className="w-4 h-4" />}
        onClick={() => router.push('/saelger/koldkampagner')}
      >
        Tilbage til kampagner
      </Button>

      {/* Campaign Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{campaign?.name}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{leads.length} leads</p>
      </div>

      {/* Search and View Toggle */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Søg efter lead..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Sort Toggle */}
              <button
                onClick={() => setSortByStatus(!sortByStatus)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  sortByStatus
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <ArrowUpDown className="w-4 h-4" />
                Status
              </button>

              {/* View Toggle */}
              <div className="flex bg-gray-100 dark:bg-dark-hover rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title="Liste visning"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title="Grid visning"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads List/Grid */}
      <Card>
        {/* List View */}
        {viewMode === 'list' && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Navn</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableEmpty message="Ingen leads fundet" />
            ) : (
              filteredLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium text-gray-900 dark:text-white">
                    {lead.name}
                  </TableCell>
                  <TableCell>{lead.phone}</TableCell>
                  <TableCell>{lead.email || '-'}</TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Phone className="w-4 h-4 text-success" />}
                        onClick={() => handleCall(lead)}
                        title="Ring op"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Calendar className="w-4 h-4 text-primary-400" />}
                        onClick={() => openMeetingModal(lead)}
                        title="Book møde"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Edit3 className="w-4 h-4 text-gray-400" />}
                        onClick={() => openLeadModal(lead)}
                        title="Rediger"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="p-6">
            {filteredLeads.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                Ingen leads fundet
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="p-4 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {lead.name}
                        </h3>
                        {lead.company && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {lead.company}
                          </p>
                        )}
                      </div>
                      <LeadStatusBadge status={lead.status} />
                    </div>

                    <div className="space-y-2 text-sm">
                      <a
                        href={`/saelger/ring-op?phone=${encodeURIComponent(lead.phone)}&lead_id=${lead.id}`}
                        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        <Phone className="w-4 h-4" />
                        {lead.phone}
                      </a>
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          <Mail className="w-4 h-4" />
                          {lead.email}
                        </a>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-border flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Phone className="w-4 h-4 text-success" />}
                        onClick={() => handleCall(lead)}
                        title="Ring op"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Calendar className="w-4 h-4 text-primary-400" />}
                        onClick={() => openMeetingModal(lead)}
                        title="Book møde"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Edit3 className="w-4 h-4 text-gray-400" />}
                        onClick={() => openLeadModal(lead)}
                        title="Rediger"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Lead Edit Modal */}
      <Modal
        isOpen={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        title={`Lead: ${selectedLead?.name}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-100 dark:bg-dark-hover rounded-lg">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Telefon</p>
              <p className="text-gray-900 dark:text-white">{selectedLead?.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-gray-900 dark:text-white">{selectedLead?.email || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Virksomhed</p>
              <p className="text-gray-900 dark:text-white">{selectedLead?.company || '-'}</p>
            </div>
          </div>

          <Select
            label="Status"
            value={leadStatus}
            onChange={(e) => setLeadStatus(e.target.value)}
            options={leadStatuses}
          />

          <div>
            <label className="label">Noter</label>
            <WYSIWYGEditor
              content={leadNotes}
              onChange={setLeadNotes}
              placeholder="Tilføj noter..."
            />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Button onClick={saveLeadChanges} loading={submitting} className="w-full">
            Gem Ændringer
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="danger"
              onClick={() => setShowLostModal(true)}
              icon={<X className="w-4 h-4" />}
            >
              Lead Tabt
            </Button>
            <Button
              variant="success"
              onClick={() => setShowClosedModal(true)}
              icon={<Check className="w-4 h-4" />}
            >
              Kunde Lukket
            </Button>
          </div>
        </div>
      </Modal>

      {/* Book Meeting Modal */}
      <Modal
        isOpen={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        title="Book Møde"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Møde Navn"
            value={meetingData.title}
            onChange={(e) => setMeetingData({ ...meetingData, title: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Dato"
              type="date"
              value={meetingData.date}
              onChange={(e) => setMeetingData({ ...meetingData, date: e.target.value })}
              required
            />
            <Input
              label="Tid"
              type="time"
              value={meetingData.time}
              onChange={(e) => setMeetingData({ ...meetingData, time: e.target.value })}
              required
            />
          </div>
          <Input
            label="Google Meet Link"
            type="url"
            value={meetingData.google_meet_link}
            onChange={(e) => setMeetingData({ ...meetingData, google_meet_link: e.target.value })}
            placeholder="https://meet.google.com/..."
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowMeetingModal(false)}>
            Annuller
          </Button>
          <Button onClick={createMeeting} loading={submitting}>
            Book Møde
          </Button>
        </ModalFooter>
      </Modal>

      {/* Lead Lost Modal */}
      <Modal
        isOpen={showLostModal}
        onClose={() => setShowLostModal(false)}
        title="Hvorfor er lead tabt?"
        size="md"
      >
        <TextArea
          value={lostReason}
          onChange={(e) => setLostReason(e.target.value)}
          placeholder="Forklar hvorfor dette lead er tabt..."
          required
        />
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowLostModal(false)}>
            Annuller
          </Button>
          <Button variant="danger" onClick={markLeadLost} loading={submitting}>
            Bekræft Lead Tabt
          </Button>
        </ModalFooter>
      </Modal>

      {/* Lead Closed Modal */}
      <Modal
        isOpen={showClosedModal}
        onClose={() => {
          setShowClosedModal(false)
          setSelectedBureauId('')
        }}
        title="Bekræft Kunde Lukket"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Bekræft at kunden <strong className="text-gray-900 dark:text-white">{selectedLead?.name}</strong> er
            lukket og kontrakten er underskrevet.
          </p>

          <Select
            label="Vælg Bureau"
            value={selectedBureauId}
            onChange={(e) => setSelectedBureauId(e.target.value)}
            options={[
              { value: '', label: '-- Vælg bureau --' },
              ...bureaus.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />

          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Kunden vil blive sendt til det valgte bureau for bekræftelse.
          </p>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => {
            setShowClosedModal(false)
            setSelectedBureauId('')
          }}>
            Annuller
          </Button>
          <Button
            variant="success"
            onClick={markLeadClosed}
            loading={submitting}
            disabled={!selectedBureauId}
          >
            Bekræft Kunde Lukket
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

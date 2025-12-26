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
  Building2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Lead, Bureau } from '@/types/database'

const leadStatuses = [
  { value: 'nyt_lead', label: 'Nyt Lead' },
  { value: 'kvalifikationskald_booket', label: 'Kvalifikationskald Booket' },
  { value: 'discoverykald_booket', label: 'Discoverykald Booket' },
  { value: 'salgskald_booket', label: 'Salgskald Booket' },
  { value: 'onboarding_booket', label: 'Onboarding Booket' },
  { value: 'kontrakt_sendt', label: 'Kontrakt Sendt' },
  { value: 'kontrakt_underskrevet', label: 'Kontrakt Underskrevet' },
]

export default function BureauLeadsPage() {
  const params = useParams()
  const router = useRouter()
  const [bureau, setBureau] = useState<Bureau | null>(null)
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
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [params.id])

  async function fetchData() {
    // Hent bureau
    const { data: bureauData } = await supabase
      .from('bureaus')
      .select('*')
      .eq('id', params.id)
      .single()

    if (bureauData) {
      setBureau(bureauData)

      // Hent kampagner for bureauet
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('bureau_id', params.id)
        .eq('type', 'bureau')

      if (campaigns && campaigns.length > 0) {
        // Hent leads fra disse kampagner
        const { data: leadsData } = await supabase
          .from('leads')
          .select('*')
          .in('campaign_id', campaigns.map((c) => c.id))
          .order('created_at', { ascending: false })

        setLeads(leadsData || [])
      }
    }
    setLoading(false)
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
    if (!selectedLead || !bureau) return
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Opret kunde
      const { error: customerError } = await supabase.from('customers').insert({
        name: selectedLead.name,
        email: selectedLead.email,
        phone: selectedLead.phone,
        bureau_id: bureau.id,
        saelger_id: user?.id,
        campaign_id: selectedLead.campaign_id,
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

  const filteredLeads = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone.includes(searchTerm) ||
      l.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
        onClick={() => router.push('/saelger/bureaukampagner')}
      >
        Tilbage til bureauer
      </Button>

      {/* Bureau Header */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            {bureau?.logo_url ? (
              <img
                src={bureau.logo_url}
                alt={bureau.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-dark-hover flex items-center justify-center">
                <Building2 className="w-8 h-8 text-gray-500" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{bureau?.name}</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">{leads.length} leads fra Facebook Ads</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Søg efter lead..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
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
      </Card>

      {/* Same modals as koldkampagner */}
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

      <Modal
        isOpen={showClosedModal}
        onClose={() => setShowClosedModal(false)}
        title="Bekræft Kunde Lukket"
        size="md"
      >
        <p className="text-gray-700 dark:text-gray-300">
          Bekræft at kunden <strong className="text-gray-900 dark:text-white">{selectedLead?.name}</strong> er
          lukket og kontrakten er underskrevet.
        </p>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowClosedModal(false)}>
            Annuller
          </Button>
          <Button variant="success" onClick={markLeadClosed} loading={submitting}>
            Bekræft Kunde Lukket
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

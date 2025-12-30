'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
} from '@/components/ui'
import {
  Phone,
  PhoneOff,
  PhoneForwarded,
  PhoneCall,
  Voicemail,
  UserX,
  SkipForward,
  Volume2,
  VolumeX,
  ExternalLink,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mic,
  MicOff,
  Target,
  Lightbulb,
  History,
  Calendar,
  FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Device as TwilioDevice, Call as TwilioCall } from '@twilio/voice-sdk'

interface Campaign {
  id: string
  name: string
  type: 'cold' | 'bureau'
  script?: string
  purpose?: string
}

interface CallbackLead extends Lead {
  callback_date?: string
  callback_time?: string
  callback_notes?: string
  updated_at?: string
}

type TabType = 'stamdata' | 'formaal' | 'indblik' | 'genopkald'

interface Lead {
  id: string
  company_name: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  city: string | null
  zip_code: string | null
  industry: string | null
  employees: string | null
  founded_year: number | null
  director: string | null
  company_type: string | null
  municipality: string | null
  status: string
  notes: string | null
  campaign_id: string
  created_at: string
}

interface CallResult {
  value: string
  label: string
  color: string
  icon: React.ElementType
}

const CALL_RESULTS: CallResult[] = [
  { value: 'salg', label: 'Salg', color: 'bg-green-500', icon: CheckCircle2 },
  { value: 'genopkald', label: 'Genopkald & næste', color: 'bg-yellow-500', icon: PhoneForwarded },
  { value: 'telefonsvarer', label: 'Telefonsvarer', color: 'bg-gray-400', icon: Voicemail },
  { value: 'ikke_interesseret', label: 'Ikke interesseret', color: 'bg-red-500', icon: UserX },
  { value: 'forkert_nummer', label: 'Forkert nummer', color: 'bg-orange-500', icon: XCircle },
  { value: 'ring_tilbage', label: 'Ring tilbage senere', color: 'bg-blue-500', icon: Clock },
]

export default function AutodialerPage() {
  const supabase = createClient()

  // Campaign & Lead state
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')
  const [leads, setLeads] = useState<Lead[]>([])
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [leadsLoading, setLeadsLoading] = useState(false)

  // Twilio state
  const [deviceReady, setDeviceReady] = useState(false)
  const [callStatus, setCallStatus] = useState<'idle' | 'initializing' | 'ready' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'error'>('idle')
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const deviceRef = useRef<TwilioDevice | null>(null)
  const activeCallRef = useRef<TwilioCall | null>(null)
  const callSidRef = useRef<string | null>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)
  const callStartTimeRef = useRef<Date | null>(null)

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('stamdata')

  // Callback leads for "Mine genopkald" tab
  const [callbackLeads, setCallbackLeads] = useState<CallbackLead[]>([])
  const [callbackLoading, setCallbackLoading] = useState(false)

  // Lead call history for "Indblik" tab
  const [leadCallHistory, setLeadCallHistory] = useState<any[]>([])
  const [leadHistoryLoading, setLeadHistoryLoading] = useState(false)

  // Result state
  const [selectedResult, setSelectedResult] = useState<string>('')
  const [omsaetning, setOmsaetning] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [callbackDate, setCallbackDate] = useState<string>('')
  const [callbackTime, setCallbackTime] = useState<string>('')

  // Stats
  const [sessionStats, setSessionStats] = useState({
    totalCalls: 0,
    salg: 0,
    genopkald: 0,
    ikkeInteresseret: 0,
  })

  const currentLead = leads[currentLeadIndex] || null
  const isInCall = callStatus === 'connected' || callStatus === 'ringing' || callStatus === 'connecting'

  // Initialize Twilio Device
  const initializeDevice = useCallback(async () => {
    try {
      setCallStatus('initializing')
      setErrorMessage(null)

      const response = await fetch('/api/twilio/token', {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Kunne ikke hente token')
      }

      const { token } = await response.json()

      const { Device, Call } = await import('@twilio/voice-sdk')

      const device = new Device(token, {
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      })

      device.on('registered', () => {
        console.log('Twilio Device registered')
        setDeviceReady(true)
        setCallStatus('ready')
      })

      device.on('error', (error) => {
        console.error('Twilio Device error:', error)
        setErrorMessage(error.message)
        setCallStatus('error')
        toast.error(`Twilio fejl: ${error.message}`)
      })

      device.on('tokenWillExpire', async () => {
        const response = await fetch('/api/twilio/token', { method: 'POST' })
        const { token } = await response.json()
        device.updateToken(token)
      })

      await device.register()
      deviceRef.current = device

    } catch (error: any) {
      console.error('Device initialization error:', error)
      const message = error?.message || 'Ukendt fejl'
      setErrorMessage(message)
      setCallStatus('error')
      toast.error('Kunne ikke initialisere telefon')
    }
  }, [])

  useEffect(() => {
    fetchCampaigns()
    initializeDevice()

    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy()
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }
    }
  }, [initializeDevice])

  useEffect(() => {
    if (selectedCampaignId) {
      fetchLeads(selectedCampaignId)
    }
  }, [selectedCampaignId])

  // Fetch callback leads when switching to genopkald tab
  useEffect(() => {
    if (activeTab === 'genopkald') {
      fetchCallbackLeads()
    }
  }, [activeTab])

  // Fetch lead history when switching to indblik tab
  useEffect(() => {
    if (activeTab === 'indblik' && currentLead?.id) {
      fetchLeadCallHistory(currentLead.id)
    }
  }, [activeTab, currentLead?.id])

  useEffect(() => {
    if (callStatus === 'connected') {
      callStartTimeRef.current = new Date()
      callTimerRef.current = setInterval(() => {
        const now = new Date()
        const diff = Math.floor((now.getTime() - callStartTimeRef.current!.getTime()) / 1000)
        setCallDuration(diff)
      }, 1000)
    } else if (callStatus !== 'ringing' && callStatus !== 'connecting') {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }
    }
  }, [callStatus])

  async function fetchCampaigns() {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name, type')
        .eq('is_active', true)
        .order('name')

      if (error) {
        console.error('Error fetching campaigns:', error)
        toast.error('Kunne ikke hente kampagner')
        setLoading(false)
        return
      }

      setCampaigns(data || [])
    } catch (err) {
      console.error('Unexpected error fetching campaigns:', err)
      toast.error('Uventet fejl ved hentning af kampagner')
    } finally {
      setLoading(false)
    }
  }

  // Fetch callback leads for "Mine genopkald" tab
  async function fetchCallbackLeads() {
    setCallbackLoading(true)
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'genopkald')
        .eq('assigned_saelger_id', user.user.id)
        .order('updated_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setCallbackLeads(data || [])
    } catch (error) {
      console.error('Error fetching callback leads:', error)
    } finally {
      setCallbackLoading(false)
    }
  }

  // Fetch call history for current lead (Indblik tab)
  async function fetchLeadCallHistory(leadId: string) {
    setLeadHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setLeadCallHistory(data || [])
    } catch (error) {
      console.error('Error fetching lead history:', error)
    } finally {
      setLeadHistoryLoading(false)
    }
  }

  async function fetchLeads(campaignId: string) {
    setLeadsLoading(true)

    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) {
        console.error('Error fetching leads:', error)
        toast.error('Kunne ikke hente leads: ' + error.message)
        setLeadsLoading(false)
        return
      }

      const activeLeads = (data || []).filter(lead =>
        ['nyt_lead', 'kontaktet', 'genopkald'].includes(lead.status)
      )

      setLeads(activeLeads)
      setCurrentLeadIndex(0)
      resetCallState()
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('Uventet fejl ved hentning af leads')
    } finally {
      setLeadsLoading(false)
    }
  }

  function resetCallState() {
    setCallDuration(0)
    setSelectedResult('')
    setOmsaetning('')
    setNotes('')
    setCallbackDate('')
    setCallbackTime('')
    setIsMuted(false)
    setLeadCallHistory([])
  }

  // Select a callback lead to call
  function selectCallbackLead(lead: CallbackLead) {
    // Find if this lead is in current campaign
    const leadIndex = leads.findIndex(l => l.id === lead.id)
    if (leadIndex !== -1) {
      setCurrentLeadIndex(leadIndex)
    } else {
      // Add to leads array temporarily
      setLeads(prev => [lead, ...prev])
      setCurrentLeadIndex(0)
    }
    setActiveTab('stamdata')
    toast.success(`Skiftet til ${lead.company_name || lead.contact_person}`)
  }

  async function startCall() {
    if (!currentLead || !currentLead.phone) {
      toast.error('Lead har intet telefonnummer')
      return
    }

    if (!deviceRef.current || !deviceReady) {
      toast.error('Telefon ikke klar - vent venligst')
      return
    }

    setCallStatus('connecting')
    setErrorMessage(null)

    try {
      // Parse phone number - assume Danish if no country code
      let fullNumber = currentLead.phone.trim().replace(/\s/g, '')

      // Remove any non-digit characters except leading +
      if (fullNumber.startsWith('+')) {
        fullNumber = '+' + fullNumber.slice(1).replace(/\D/g, '')
      } else {
        fullNumber = fullNumber.replace(/\D/g, '')
        // Check if it already starts with country code 45
        // Danish numbers are 8 digits, so 45 + 8 = 10 digits total
        if (fullNumber.startsWith('45') && fullNumber.length >= 10) {
          fullNumber = '+' + fullNumber
        } else {
          fullNumber = '+45' + fullNumber
        }
      }

      console.log('Dialing number:', fullNumber)

      const call = await deviceRef.current.connect({
        params: {
          To: fullNumber,
        },
      })

      console.log('Call object created:', call)

      activeCallRef.current = call

      call.on('ringing', () => {
        console.log('Call ringing...')
        setCallStatus('ringing')
      })

      call.on('accept', () => {
        console.log('Call accepted')
        const callSid = call.parameters?.CallSid
        if (callSid) {
          callSidRef.current = callSid
        }
        setCallStatus('connected')
        toast.success('Forbundet!')
      })

      call.on('disconnect', () => {
        console.log('Call disconnected')
        handleCallEnd()
      })

      call.on('cancel', () => {
        console.log('Call cancelled')
        handleCallEnd()
      })

      call.on('reject', () => {
        console.log('Call rejected')
        toast.error('Opkald afvist')
        handleCallEnd()
      })

      call.on('error', (error) => {
        console.error('Call error:', error)
        toast.error(`Opkaldsfejl: ${error.message}`)
        handleCallEnd()
      })

    } catch (error: any) {
      console.error('Start call error:', error)
      toast.error('Kunne ikke starte opkald')
      setCallStatus('ready')
    }
  }

  async function handleCallEnd() {
    let duration = 0
    if (callStartTimeRef.current) {
      const now = new Date()
      duration = Math.floor((now.getTime() - callStartTimeRef.current.getTime()) / 1000)
    }

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }

    const callSid = callSidRef.current

    // Log call to database
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Parse phone number for logging
      let phoneNumber = currentLead?.phone?.replace(/\D/g, '') || ''
      let countryCode = '+45'
      if (currentLead?.phone?.startsWith('+')) {
        countryCode = currentLead.phone.slice(0, 3)
        phoneNumber = currentLead.phone.slice(3).replace(/\D/g, '')
      }

      const { error } = await supabase.from('call_logs').insert({
        saelger_id: user?.id,
        phone_number: phoneNumber,
        country_code: countryCode,
        duration_seconds: duration,
        direction: 'outbound',
        status: duration > 0 ? 'completed' : 'no_answer',
        lead_id: currentLead?.id || null,
        call_sid: callSid || null,
      })

      if (error) {
        console.error('Error logging call:', error)
      }
    } catch (error) {
      console.error('Error logging call:', error)
    }

    setCallStatus('ended')
    activeCallRef.current = null
    callStartTimeRef.current = null
    callSidRef.current = null

    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      totalCalls: prev.totalCalls + 1,
    }))

    setTimeout(() => {
      setCallStatus('ready')
      setCallDuration(0)
    }, 1000)
  }

  function endCall() {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect()
    }
  }

  function toggleMute() {
    if (activeCallRef.current) {
      const newMuteState = !isMuted
      activeCallRef.current.mute(newMuteState)
      setIsMuted(newMuteState)
      toast(newMuteState ? 'Mikrofon slukket' : 'Mikrofon tændt')
    }
  }

  async function saveResultAndNext() {
    if (!selectedResult) {
      toast.error('Vælg et resultat')
      return
    }

    if (!currentLead) return

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        toast.error('Du skal være logget ind')
        return
      }

      let newStatus = currentLead.status
      if (selectedResult === 'salg') {
        // For salg, set status til kontrakt flow
        newStatus = 'kvalifikationskald_booket'
      } else if (selectedResult === 'ikke_interesseret' || selectedResult === 'forkert_nummer') {
        newStatus = 'lead_tabt'
      } else if (selectedResult === 'genopkald' || selectedResult === 'ring_tilbage') {
        newStatus = 'genopkald'
      } else if (selectedResult === 'telefonsvarer') {
        newStatus = 'kontaktet'
      }

      const updateData: any = {
        status: newStatus,
        assigned_saelger_id: userData.user.id, // Altid tildel lead til nuværende sælger
        updated_at: new Date().toISOString(),
      }

      // Only update notes if there are new notes
      if (notes) {
        updateData.notes = `${currentLead.notes || ''}\n\n[${new Date().toLocaleString('da-DK')}] ${selectedResult}: ${notes}`.trim()
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', currentLead.id)

      if (error) {
        console.error('Error saving result:', error)
        toast.error('Kunne ikke gemme resultat')
        return
      }

      setSessionStats(prev => ({
        ...prev,
        salg: selectedResult === 'salg' ? prev.salg + 1 : prev.salg,
        genopkald: selectedResult === 'genopkald' || selectedResult === 'ring_tilbage' ? prev.genopkald + 1 : prev.genopkald,
        ikkeInteresseret: selectedResult === 'ikke_interesseret' ? prev.ikkeInteresseret + 1 : prev.ikkeInteresseret,
      }))

      goToNextLead()
      toast.success('Resultat gemt')
    } catch (err) {
      console.error('Unexpected error saving result:', err)
      toast.error('Uventet fejl ved gemning af resultat')
    }
  }

  function goToNextLead() {
    resetCallState()
    if (currentLeadIndex < leads.length - 1) {
      setCurrentLeadIndex(prev => prev + 1)
    } else {
      toast('Ingen flere leads i køen', { icon: '📭' })
    }
  }

  function skipLead() {
    goToNextLead()
  }

  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  // Campaign Selection Screen
  if (!selectedCampaignId) {
    return (
      <div className="max-w-2xl mx-auto mt-20">
        <Card>
          <CardContent className="py-12">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <PhoneCall className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Autodialer</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Vælg en kampagne for at starte</p>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Kampagne
              </label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Vælg kampagne...</option>
                {campaigns.map(campaign => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} ({campaign.type === 'cold' ? 'Kold' : 'Bureau'})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading leads
  if (leadsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Henter leads...</p>
        </div>
      </div>
    )
  }

  // No leads
  if (leads.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-20">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-dark-hover rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Ingen leads</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                Der er ingen aktive leads i denne kampagne
              </p>
              <button
                onClick={() => setSelectedCampaignId('')}
                className="mt-6 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                Vælg anden kampagne
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-6rem)]">
      {/* Header with campaign info */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedCampaignId('')}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            ← Skift kampagne
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {campaigns.find(c => c.id === selectedCampaignId)?.name}
          </h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Lead {currentLeadIndex + 1} af {leads.length}
          </span>
          {/* Device Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              deviceReady ? 'bg-success animate-pulse' :
              callStatus === 'error' ? 'bg-danger' :
              'bg-warning animate-pulse'
            }`} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {deviceReady ? 'Telefon klar' : callStatus === 'initializing' ? 'Initialiserer...' : 'Fejl'}
            </span>
          </div>
        </div>

        {/* Session Stats */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">{sessionStats.totalCalls} opkald</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-green-600 dark:text-green-400">{sessionStats.salg} salg</span>
          </div>
          <div className="flex items-center gap-2">
            <PhoneForwarded className="w-4 h-4 text-yellow-500" />
            <span className="text-yellow-600 dark:text-yellow-400">{sessionStats.genopkald} genopkald</span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-4 bg-danger/10 border border-danger/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-danger font-medium">Fejl</p>
            <p className="text-sm text-danger/80">{errorMessage}</p>
          </div>
          <button
            onClick={initializeDevice}
            className="px-3 py-1 text-sm bg-danger/20 text-danger rounded hover:bg-danger/30 transition-colors"
          >
            Prøv igen
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100%-3rem)]">
        {/* Left Panel - Lead Info */}
        <Card className="overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-dark-border">
            <button
              onClick={() => setActiveTab('stamdata')}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'stamdata'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Emne stamdata
            </button>
            <button
              onClick={() => setActiveTab('formaal')}
              className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'formaal'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Target className="w-4 h-4" />
              Formål
            </button>
            <button
              onClick={() => setActiveTab('indblik')}
              className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'indblik'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              Indblik
            </button>
            <button
              onClick={() => setActiveTab('genopkald')}
              className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'genopkald'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <History className="w-4 h-4" />
              Mine genopkald
              {callbackLeads.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                  {callbackLeads.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <CardContent className="flex-1 overflow-y-auto">
            {/* Stamdata Tab */}
            {activeTab === 'stamdata' && (
              <>
                {currentLead ? (
                  <div className="space-y-6">
                    {/* Company Info Grid */}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kampagnenavn</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {campaigns.find(c => c.id === selectedCampaignId)?.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reklamebeskyttet</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Nej</p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Navn</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {currentLead.company_name || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Type</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {currentLead.company_type || '-'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Stiftet</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {currentLead.founded_year || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Telefon</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {currentLead.phone || '-'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Direktør</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {currentLead.director || currentLead.contact_person || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ansatte</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {currentLead.employees || '-'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kommune</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {currentLead.municipality || currentLead.city || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Website</p>
                        {currentLead.website ? (
                          <a
                            href={currentLead.website.startsWith('http') ? currentLead.website : `https://${currentLead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                          >
                            {currentLead.website}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-gray-900 dark:text-white">-</p>
                        )}
                      </div>
                    </div>

                    {/* Result Selection */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Resultat</p>
                      <select
                        value={selectedResult}
                        onChange={(e) => setSelectedResult(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-yellow-100 dark:bg-yellow-900/30 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Vælg resultat...</option>
                        {CALL_RESULTS.map(result => (
                          <option key={result.value} value={result.value}>
                            {result.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Callback Date/Time - show when genopkald or ring_tilbage selected */}
                    {(selectedResult === 'genopkald' || selectedResult === 'ring_tilbage') && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Dato for genopkald</p>
                          <input
                            type="date"
                            value={callbackDate}
                            onChange={(e) => setCallbackDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Tidspunkt</p>
                          <input
                            type="time"
                            value={callbackTime}
                            onChange={(e) => setCallbackTime(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Omsætning */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Omsætning</p>
                      <input
                        type="text"
                        value={omsaetning}
                        onChange={(e) => setOmsaetning(e.target.value)}
                        placeholder="Indtast omsætning..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Notater</p>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Tilføj noter..."
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    Ingen lead valgt
                  </div>
                )}
              </>
            )}

            {/* Formål Tab - Campaign Script/Purpose */}
            {activeTab === 'formaal' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <Target className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Kampagnens Formål</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {campaigns.find(c => c.id === selectedCampaignId)?.name}
                    </p>
                  </div>
                </div>

                {/* Purpose */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Formål</h4>
                  <div className="p-4 bg-gray-50 dark:bg-dark-hover rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {campaigns.find(c => c.id === selectedCampaignId)?.purpose ||
                       'Intet formål defineret for denne kampagne. Tilføj formål i kampagneindstillinger.'}
                    </p>
                  </div>
                </div>

                {/* Script */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Salgsmanus
                  </h4>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
                      {campaigns.find(c => c.id === selectedCampaignId)?.script ||
                       `Hej, mit navn er [DIT NAVN] fra Øresund Partners.

Jeg ringer fordi vi hjælper virksomheder som jer med at optimere deres markedsføring og få flere kunder.

Har I et par minutter til at høre, hvordan vi kan hjælpe jer?

[LYTT TIL SVAR]

[VED INTERESSE]
Fantastisk! Lad mig fortælle lidt mere om...

[VED AFVISNING]
Ingen problem - tak for din tid. Ha' en god dag!`}
                    </p>
                  </div>
                </div>

                {/* Quick Tips */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    Hurtige Tips
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-primary-500 mt-1">•</span>
                      Smil når du ringer - det kan høres i din stemme
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-500 mt-1">•</span>
                      Lyt aktivt og stil åbne spørgsmål
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-500 mt-1">•</span>
                      Notér vigtige detaljer til næste opkald
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Indblik Tab - Lead Insights & History */}
            {activeTab === 'indblik' && (
              <div className="space-y-6">
                {currentLead ? (
                  <>
                    {/* Lead Summary */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Lightbulb className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {currentLead.company_name || currentLead.contact_person || 'Lead'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Indsigt & historik
                        </p>
                      </div>
                    </div>

                    {/* Lead Status */}
                    <div className="p-4 bg-gray-50 dark:bg-dark-hover rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                            {currentLead.status?.replace('_', ' ') || 'Ukendt'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Oprettet</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(currentLead.created_at).toLocaleDateString('da-DK')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Previous Notes */}
                    {currentLead.notes && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Tidligere noter
                        </h4>
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {currentLead.notes}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Call History */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Opkaldshistorik
                      </h4>
                      {leadHistoryLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                        </div>
                      ) : leadCallHistory.length === 0 ? (
                        <div className="p-4 bg-gray-50 dark:bg-dark-hover rounded-lg text-center">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Ingen tidligere opkald til dette lead
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {leadCallHistory.map((call) => (
                            <div
                              key={call.id}
                              className="p-3 bg-gray-50 dark:bg-dark-hover rounded-lg flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  call.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                                  call.status === 'no_answer' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                                  'bg-gray-100 dark:bg-dark-border'
                                }`}>
                                  <Phone className={`w-4 h-4 ${
                                    call.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                                    call.status === 'no_answer' ? 'text-yellow-600 dark:text-yellow-400' :
                                    'text-gray-500'
                                  }`} />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {new Date(call.created_at).toLocaleDateString('da-DK')} kl. {new Date(call.created_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {call.status === 'completed' ? 'Besvaret' : call.status === 'no_answer' ? 'Ikke besvaret' : call.status}
                                    {call.duration_seconds > 0 && ` • ${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}`}
                                  </p>
                                </div>
                              </div>
                              {call.recording_sid && (
                                <span className="text-xs text-primary-600 dark:text-primary-400">
                                  🎙️ Optaget
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    Vælg et lead for at se indblik
                  </div>
                )}
              </div>
            )}

            {/* Mine Genopkald Tab */}
            {activeTab === 'genopkald' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                      <History className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">Mine Genopkald</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {callbackLeads.length} afventende genopkald
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={fetchCallbackLeads}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-border transition-colors"
                    title="Opdater liste"
                  >
                    <RefreshCw className={`w-4 h-4 ${callbackLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {callbackLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                  </div>
                ) : callbackLeads.length === 0 ? (
                  <div className="p-8 bg-gray-50 dark:bg-dark-hover rounded-lg text-center">
                    <History className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Ingen planlagte genopkald
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      Markér leads som "Genopkald" for at se dem her
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {callbackLeads.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => selectCallbackLead(lead)}
                        className="w-full p-4 bg-gray-50 dark:bg-dark-hover rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border transition-colors text-left group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {lead.company_name || lead.contact_person || 'Ukendt'}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {lead.phone || '-'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString('da-DK') : '-'}
                              </span>
                            </div>
                            {lead.notes && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                                {lead.notes.split('\n').pop()}
                              </p>
                            )}
                          </div>
                          <div className="ml-4 flex items-center gap-2">
                            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                              Genopkald
                            </span>
                            <Phone className="w-5 h-5 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Panel - Dialer */}
        <Card className="overflow-hidden flex flex-col">
          {/* Dialer Header */}
          <div className={`px-6 py-4 ${isInCall ? 'bg-green-500' : 'bg-primary-600'} text-white`}>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5" />
              <span className="font-medium">
                {isInCall ? 'I opkald' : 'Autodialer'}
              </span>
            </div>
            <div className="text-sm opacity-90 mt-1">
              Emne-ID: # {currentLead?.id?.slice(0, 12) || '-'}
            </div>
          </div>

          <CardContent className="flex-1 flex flex-col">
            {/* Call Status */}
            <div className="text-center py-6 border-b border-gray-200 dark:border-dark-border">
              {callStatus === 'connecting' ? (
                <div>
                  <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                    <Phone className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">Opretter forbindelse...</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {currentLead?.phone}
                  </p>
                </div>
              ) : callStatus === 'ringing' ? (
                <div>
                  <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
                    <Phone className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">Ringer...</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {currentLead?.phone}
                  </p>
                </div>
              ) : callStatus === 'connected' ? (
                <div>
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <PhoneCall className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">Forbundet</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                    {formatDuration(callDuration)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {currentLead ? 'Klar til at ringe' : 'Intet emne valgt'}
                  </p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white mt-2">
                    {currentLead?.phone || '-'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {currentLead?.company_name || currentLead?.contact_person || ''}
                  </p>
                </div>
              )}
            </div>

            {/* Dialer Controls */}
            <div className="flex-1 flex flex-col justify-center">
              {/* Main Action Buttons */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {/* Ring emne op nu */}
                <button
                  onClick={startCall}
                  disabled={isInCall || !currentLead?.phone || !deviceReady}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Phone className="w-8 h-8" />
                  <span className="text-xs font-medium">Ring emne op nu</span>
                </button>

                {/* Mute/Unmute (during call) */}
                <button
                  onClick={toggleMute}
                  disabled={!isInCall}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isMuted
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      : 'bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-border'
                  }`}
                >
                  {isMuted ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                  <span className="text-xs font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
                </button>

                {/* Læg på */}
                <button
                  onClick={endCall}
                  disabled={!isInCall}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PhoneOff className="w-8 h-8" />
                  <span className="text-xs font-medium">Læg på</span>
                </button>
              </div>

              {/* Secondary Action Buttons */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {/* Genopkald & næste */}
                <button
                  onClick={() => {
                    setSelectedResult('genopkald')
                    saveResultAndNext()
                  }}
                  disabled={isInCall}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-8 h-8" />
                  <span className="text-xs font-medium">Genopkald & næste</span>
                </button>

                {/* Telefonsvarer */}
                <button
                  onClick={() => {
                    setSelectedResult('telefonsvarer')
                    saveResultAndNext()
                  }}
                  disabled={isInCall}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Voicemail className="w-8 h-8" />
                  <span className="text-xs font-medium">Telefonsvarer</span>
                </button>

                {/* Ikke interesseret */}
                <button
                  onClick={() => {
                    setSelectedResult('ikke_interesseret')
                    saveResultAndNext()
                  }}
                  disabled={isInCall}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserX className="w-8 h-8" />
                  <span className="text-xs font-medium">Ikke interesseret</span>
                </button>
              </div>

              {/* Bottom Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Skip */}
                <button
                  onClick={skipLead}
                  disabled={isInCall}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SkipForward className="w-8 h-8" />
                  <span className="text-xs font-medium">Spring over</span>
                </button>

                {/* Salg */}
                <button
                  onClick={() => {
                    setSelectedResult('salg')
                    saveResultAndNext()
                  }}
                  disabled={isInCall}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-8 h-8" />
                  <span className="text-xs font-medium">Salg!</span>
                </button>
              </div>
            </div>

            {/* Save & Next Button */}
            {selectedResult && !isInCall && (
              <div className="pt-4 border-t border-gray-200 dark:border-dark-border">
                <button
                  onClick={saveResultAndNext}
                  className="w-full py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Gem resultat og gå til næste
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

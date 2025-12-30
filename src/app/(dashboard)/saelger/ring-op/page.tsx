'use client'

import { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, Button, Input, Select } from '@/components/ui'
import { Phone, PhoneOff, Mic, MicOff, Clock, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Device as TwilioDevice, Call as TwilioCall } from '@twilio/voice-sdk'

const countryCodes = [
  { value: '+45', label: 'Danmark (+45)' },
  { value: '+46', label: 'Sverige (+46)' },
  { value: '+47', label: 'Norge (+47)' },
  { value: '+49', label: 'Tyskland (+49)' },
  { value: '+44', label: 'UK (+44)' },
  { value: '+1', label: 'USA/Canada (+1)' },
]

function RingOpContent() {
  const searchParams = useSearchParams()
  const [countryCode, setCountryCode] = useState('+45')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isCallActive, setIsCallActive] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [callStatus, setCallStatus] = useState<'idle' | 'initializing' | 'ready' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'error'>('idle')
  const [leadId, setLeadId] = useState<string | null>(null)
  const [deviceReady, setDeviceReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const callTimerRef = useRef<NodeJS.Timeout | null>(null)
  const callStartTimeRef = useRef<Date | null>(null)
  const deviceRef = useRef<TwilioDevice | null>(null)
  const activeCallRef = useRef<TwilioCall | null>(null)
  const callSidRef = useRef<string | null>(null)

  const supabase = createClient()

  // Initialize Twilio Device
  const initializeDevice = useCallback(async () => {
    try {
      setCallStatus('initializing')
      setErrorMessage(null)

      // Get access token from our API
      const response = await fetch('/api/twilio/token', {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Kunne ikke hente token')
      }

      const { token } = await response.json()

      // Dynamically import Twilio Voice SDK (client-side only)
      const { Device, Call } = await import('@twilio/voice-sdk')

      // Create and setup Device
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

      device.on('incoming', (call) => {
        console.log('Incoming call:', call)
        // Handle incoming calls if needed
      })

      device.on('tokenWillExpire', async () => {
        console.log('Token will expire, refreshing...')
        const response = await fetch('/api/twilio/token', { method: 'POST' })
        const { token } = await response.json()
        device.updateToken(token)
      })

      await device.register()
      deviceRef.current = device

    } catch (error: any) {
      console.error('Device initialization error:', error)
      const message = error?.message || error?.toString() || 'Ukendt fejl'
      setErrorMessage(message)
      setCallStatus('error')
      toast.error('Kunne ikke initialisere telefon')
    }
  }, [])

  useEffect(() => {
    initializeDevice()

    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy()
      }
    }
  }, [initializeDevice])

  // Get URL params
  const phoneParam = searchParams.get('phone')
  const leadParam = searchParams.get('lead_id')

  useEffect(() => {
    // Pre-fill from URL params
    if (phoneParam) {
      let cleanPhone = phoneParam.trim()

      // Check if phone starts with + and extract country code
      if (cleanPhone.startsWith('+')) {
        // Try to match known country codes (check longest first to avoid partial matches)
        const sortedCodes = [...countryCodes].sort((a, b) => b.value.length - a.value.length)

        for (const code of sortedCodes) {
          if (cleanPhone.startsWith(code.value)) {
            setCountryCode(code.value)
            cleanPhone = cleanPhone.slice(code.value.length)
            break
          }
        }
      }

      // Remove any remaining non-digit characters (spaces, dashes, etc.)
      cleanPhone = cleanPhone.replace(/\D/g, '')
      setPhoneNumber(cleanPhone)
    }
    if (leadParam) {
      setLeadId(leadParam)
    }
  }, [phoneParam, leadParam])

  useEffect(() => {
    if (callStatus === 'connected') {
      callStartTimeRef.current = new Date()
      callTimerRef.current = setInterval(() => {
        const now = new Date()
        const diff = Math.floor((now.getTime() - callStartTimeRef.current!.getTime()) / 1000)
        setCallDuration(diff)
      }, 1000)
    } else {
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

  async function startCall() {
    if (!phoneNumber) {
      toast.error('Indtast et telefonnummer')
      return
    }

    if (!deviceRef.current || !deviceReady) {
      toast.error('Telefon ikke klar - prøv at genindlæse siden')
      return
    }

    setCallStatus('connecting')
    setErrorMessage(null)

    try {
      const fullNumber = `${countryCode}${phoneNumber}`

      // Make outbound call via Twilio Device
      const call = await deviceRef.current.connect({
        params: {
          To: fullNumber,
        },
      })

      activeCallRef.current = call

      call.on('ringing', () => {
        console.log('Call ringing...')
        setCallStatus('ringing')
      })

      call.on('accept', () => {
        console.log('Call accepted')
        // Get the call SID from parameters
        const callSid = call.parameters?.CallSid
        console.log('Call SID found:', callSid)
        if (callSid) {
          callSidRef.current = callSid
        }
        setIsCallActive(true)
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
    // Calculate duration from ref (not state, to avoid stale closure)
    let duration = 0
    if (callStartTimeRef.current) {
      const now = new Date()
      duration = Math.floor((now.getTime() - callStartTimeRef.current.getTime()) / 1000)
    }

    // Stop the timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }

    // Get the call SID from ref (not affected by closure issues)
    const callSid = callSidRef.current
    console.log('Logging call with SID:', callSid)

    // Log call to database
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Log all calls, even if short duration (use 0 for unanswered)
      const { error } = await supabase.from('call_logs').insert({
        saelger_id: user?.id,
        phone_number: phoneNumber,
        country_code: countryCode,
        duration_seconds: duration,
        direction: 'outbound',
        status: duration > 0 ? 'completed' : 'no_answer',
        lead_id: leadId || null,
        call_sid: callSid || null,
      })

      if (error) {
        console.error('Error logging call:', error)
        toast.error('Kunne ikke gemme opkaldslog')
      } else {
        console.log('Call logged successfully:', { duration, phoneNumber, callSid })
      }
    } catch (error) {
      console.error('Error logging call:', error)
    }

    setIsCallActive(false)
    setCallStatus('ended')
    activeCallRef.current = null
    callStartTimeRef.current = null
    callSidRef.current = null

    if (duration > 0) {
      toast.success(`Opkald afsluttet (${formatDuration(duration)})`)
    }

    // Reset after a moment
    setTimeout(() => {
      setCallStatus('ready')
      setCallDuration(0)
    }, 2000)
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

  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  function getStatusText() {
    switch (callStatus) {
      case 'initializing': return 'Initialiserer telefon...'
      case 'ready': return 'Klar til at ringe'
      case 'connecting': return 'Opretter forbindelse...'
      case 'ringing': return 'Ringer...'
      case 'connected': return `${countryCode} ${phoneNumber}`
      case 'ended': return 'Opkald afsluttet'
      case 'error': return 'Fejl - prøv igen'
      default: return ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ring Op</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Foretag VoIP opkald direkte fra browseren</p>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-danger font-medium">Fejl</p>
            <p className="text-sm text-danger/80">{errorMessage}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-danger"
              onClick={initializeDevice}
            >
              Prøv igen
            </Button>
          </div>
        </div>
      )}

      {/* Dialer */}
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="py-8">
            <div className="space-y-6">
              {/* Status Indicator */}
              <div className="flex items-center justify-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  deviceReady ? 'bg-success animate-pulse' :
                  callStatus === 'error' ? 'bg-danger' :
                  'bg-warning animate-pulse'
                }`} />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {getStatusText()}
                </span>
              </div>

              {/* Phone Number Input */}
              <div className="flex gap-2">
                <Select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  options={countryCodes}
                  className="w-40"
                  disabled={isCallActive}
                />
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="12 34 56 78"
                  className="flex-1 text-center text-xl tracking-widest"
                  disabled={isCallActive}
                />
              </div>

              {/* Call Timer */}
              {(callStatus === 'connected' || callStatus === 'ringing' || callStatus === 'connecting') && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-2xl font-mono text-gray-900 dark:text-white">
                      {formatDuration(callDuration)}
                    </span>
                  </div>
                </div>
              )}

              {/* Call Controls */}
              <div className="flex items-center justify-center gap-4">
                {isCallActive ? (
                  <>
                    <button
                      onClick={toggleMute}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                        isMuted
                          ? 'bg-danger text-white'
                          : 'bg-gray-100 dark:bg-dark-hover text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-border'
                      }`}
                      title={isMuted ? 'Slå mikrofon til' : 'Slå mikrofon fra'}
                    >
                      {isMuted ? (
                        <MicOff className="w-6 h-6" />
                      ) : (
                        <Mic className="w-6 h-6" />
                      )}
                    </button>
                    <button
                      onClick={endCall}
                      className="w-16 h-16 rounded-full bg-danger hover:bg-danger-dark text-white flex items-center justify-center transition-colors"
                      title="Afslut opkald"
                    >
                      <PhoneOff className="w-7 h-7" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startCall}
                    disabled={!deviceReady || callStatus === 'connecting' || callStatus === 'initializing'}
                    className="w-16 h-16 rounded-full bg-success hover:bg-success-dark text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Start opkald"
                  >
                    <Phone className="w-7 h-7" />
                  </button>
                )}
              </div>

              {/* Numpad */}
              {!isCallActive && callStatus !== 'initializing' && (
                <div className="grid grid-cols-3 gap-3 mt-6">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                    <button
                      key={digit}
                      onClick={() => setPhoneNumber(phoneNumber + digit)}
                      className="h-14 rounded-lg bg-gray-100 dark:bg-dark-hover hover:bg-gray-200 dark:hover:bg-dark-border text-gray-900 dark:text-white text-xl font-medium transition-colors"
                    >
                      {digit}
                    </button>
                  ))}
                </div>
              )}

              {/* Clear Button */}
              {!isCallActive && phoneNumber && (
                <Button
                  variant="ghost"
                  className="w-full mt-4"
                  onClick={() => setPhoneNumber('')}
                >
                  Ryd
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Tillad mikrofon-adgang i browseren for at foretage opkald</p>
        </div>
      </div>
    </div>
  )
}

export default function RingOpPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    }>
      <RingOpContent />
    </Suspense>
  )
}

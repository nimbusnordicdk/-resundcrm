import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const VoiceResponse = twilio.twiml.VoiceResponse

// Validate Twilio webhook signature
function validateTwilioSignature(
  request: NextRequest,
  formData: FormData
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN

  // Skip validation in development if no auth token
  if (!authToken) {
    console.warn('TWILIO_AUTH_TOKEN not configured - skipping signature validation')
    return process.env.NODE_ENV === 'development'
  }

  const signature = request.headers.get('X-Twilio-Signature')
  if (!signature) {
    console.error('Missing X-Twilio-Signature header')
    return false
  }

  // Get the full URL
  const url = request.url

  // Convert FormData to object for validation
  const params: Record<string, string> = {}
  formData.forEach((value, key) => {
    params[key] = value.toString()
  })

  return twilio.validateRequest(authToken, signature, url, params)
}

export async function POST(request: NextRequest) {
  try {
    // Clone request to read formData twice (once for validation, once for processing)
    const formData = await request.formData()

    // Validate Twilio signature
    if (!validateTwilioSignature(request, formData)) {
      console.error('Invalid Twilio signature - rejecting request')
      return new NextResponse('Forbidden', { status: 403 })
    }

    const twiml = new VoiceResponse()

    // Parse form data from Twilio
    const to = formData.get('To') as string
    const from = formData.get('From') as string

    console.log('Voice webhook called - To:', to, 'From:', from)

    // Check if this is an outgoing call from browser (To will be a phone number)
    if (to && to.startsWith('+')) {
      // Outgoing call from browser to phone with recording
      const dial = twiml.dial({
        callerId: process.env.TWILIO_PHONE_NUMBER,
        timeout: 30,
        answerOnBridge: true, // Only charge when call is answered
        record: 'record-from-answer-dual', // Record both legs of the call
        recordingStatusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/recording-status`,
        recordingStatusCallbackEvent: ['completed'],
      })
      dial.number(to)
    } else {
      // Incoming call or conference
      twiml.say({ language: 'da-DK' }, 'Velkommen til Øresund Partners.')
    }

    const response = twiml.toString()
    console.log('TwiML response:', response)

    return new NextResponse(response, {
      headers: {
        'Content-Type': 'application/xml',
        'ngrok-skip-browser-warning': 'true',
      },
    })
  } catch (error) {
    console.error('Voice webhook error:', error)
    const twiml = new VoiceResponse()
    twiml.say({ language: 'da-DK' }, 'Der opstod en fejl med opkaldet.')
    twiml.hangup()
    return new NextResponse(twiml.toString(), {
      headers: {
        'Content-Type': 'application/xml',
      },
    })
  }
}

export async function GET() {
  const twiml = new VoiceResponse()
  twiml.say({ language: 'da-DK' }, 'Voice webhook aktiv.')

  return new NextResponse(twiml.toString(), {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}

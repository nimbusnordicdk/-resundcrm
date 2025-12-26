import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const VoiceResponse = twilio.twiml.VoiceResponse

export async function POST(request: NextRequest) {
  try {
    const twiml = new VoiceResponse()

    // Parse form data from Twilio
    const formData = await request.formData()
    const to = formData.get('To') as string
    const from = formData.get('From') as string

    console.log('Voice webhook called - To:', to, 'From:', from)

    // Check if this is an outgoing call from browser (To will be a phone number)
    if (to && to.startsWith('+')) {
      // Outgoing call from browser to phone
      const dial = twiml.dial({
        callerId: process.env.TWILIO_PHONE_NUMBER,
        timeout: 30,
        answerOnBridge: true, // Only charge when call is answered
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

import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const apiKey = process.env.TWILIO_API_KEY
    const apiSecret = process.env.TWILIO_API_SECRET
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID

    console.log('Token request - Checking credentials...')
    console.log('Account SID:', accountSid ? `${accountSid.substring(0, 6)}...` : 'MISSING')
    console.log('API Key:', apiKey ? `${apiKey.substring(0, 6)}...` : 'MISSING')
    console.log('API Secret:', apiSecret ? 'SET' : 'MISSING')
    console.log('TwiML App SID:', twimlAppSid ? `${twimlAppSid.substring(0, 6)}...` : 'MISSING')

    if (!accountSid || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured. Check TWILIO_ACCOUNT_SID, TWILIO_API_KEY, and TWILIO_API_SECRET' },
        { status: 500 }
      )
    }

    if (!twimlAppSid) {
      return NextResponse.json(
        { error: 'TWILIO_TWIML_APP_SID not configured' },
        { status: 500 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create access token
    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant = AccessToken.VoiceGrant

    // Use a simple identity without special characters
    const identity = `user_${user.id.replace(/-/g, '_')}`

    const token = new AccessToken(
      accountSid,
      apiKey,
      apiSecret,
      { identity, ttl: 3600 }
    )

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    })

    token.addGrant(voiceGrant)

    console.log('Token generated successfully for identity:', identity)

    return NextResponse.json({
      token: token.toJwt(),
      identity,
    })
  } catch (error: any) {
    console.error('Token generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate token' },
      { status: 500 }
    )
  }
}

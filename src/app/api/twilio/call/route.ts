import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured' },
        { status: 500 }
      )
    }

    const client = twilio(accountSid, authToken)
    const { to, leadId } = await request.json()

    if (!to) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    // Create outgoing call
    const call = await client.calls.create({
      to,
      from: twilioPhoneNumber,
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/voice?leadId=${leadId || ''}`,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    })

    return NextResponse.json({
      success: true,
      callSid: call.sid,
    })
  } catch (error: any) {
    console.error('Twilio call error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to make call' },
      { status: 500 }
    )
  }
}

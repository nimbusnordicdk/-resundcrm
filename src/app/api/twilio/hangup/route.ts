import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN

    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured' },
        { status: 500 }
      )
    }

    const client = twilio(accountSid, authToken)
    const { callSid } = await request.json().catch(() => ({}))

    if (callSid) {
      await client.calls(callSid).update({ status: 'completed' })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Hangup error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to end call' },
      { status: 500 }
    )
  }
}

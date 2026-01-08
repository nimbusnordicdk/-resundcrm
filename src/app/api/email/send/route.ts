import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's SMTP settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_email_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (settingsError || !settings) {
      return NextResponse.json(
        { error: 'Email indstillinger ikke konfigureret' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { to, subject, body: emailBody } = body

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Til, emne og besked er påkrævet' },
        { status: 400 }
      )
    }

    // Create transporter with user's SMTP settings
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_port === 465,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_password,
      },
    })

    // Send email
    await transporter.sendMail({
      from: `"${settings.from_name}" <${settings.from_email}>`,
      to,
      subject,
      text: emailBody,
      html: emailBody.replace(/\n/g, '<br>'),
    })

    // Save to database
    await supabase.from('emails').insert({
      user_id: user.id,
      from_email: settings.from_email,
      from_name: settings.from_name,
      to_email: to,
      subject,
      body: emailBody,
      is_sent: true,
      is_read: true,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Email send error:', error)
    return NextResponse.json(
      { error: error.message || 'Kunne ikke sende email' },
      { status: 500 }
    )
  }
}

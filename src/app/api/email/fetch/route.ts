import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import Imap from 'imap-simple'
import { simpleParser } from 'mailparser'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's IMAP settings
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

    if (!settings.imap_host || !settings.imap_user || !settings.imap_password) {
      return NextResponse.json(
        { error: 'IMAP indstillinger mangler' },
        { status: 400 }
      )
    }

    // Connect to IMAP server
    const config = {
      imap: {
        user: settings.imap_user,
        password: settings.imap_password,
        host: settings.imap_host,
        port: settings.imap_port || 143,
        tls: settings.imap_port === 993,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000,
      }
    }

    const connection = await Imap.connect(config)
    await connection.openBox('INBOX')

    // Fetch last 50 emails
    const searchCriteria = ['ALL']
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: false,
      struct: true,
    }

    const messages = await connection.search(searchCriteria, fetchOptions)

    // Get existing emails to avoid duplicates
    const { data: existingEmails } = await supabase
      .from('emails')
      .select('from_email, subject, created_at')
      .eq('user_id', user.id)
      .eq('is_sent', false)

    const existingSet = new Set(
      existingEmails?.map(e => `${e.from_email}-${e.subject}-${e.created_at}`) || []
    )

    let newEmailsCount = 0
    const latestMessages = messages.slice(-50).reverse()

    for (const message of latestMessages) {
      try {
        const all = message.parts.find((part: any) => part.which === '')
        if (!all) continue

        const parsed = await simpleParser(all.body)

        const fromEmail = parsed.from?.value?.[0]?.address || ''
        const fromName = parsed.from?.value?.[0]?.name || ''
        const subject = parsed.subject || '(Ingen emne)'
        const body = parsed.text || ''
        const createdAt = parsed.date?.toISOString() || new Date().toISOString()

        // Check for duplicates
        const key = `${fromEmail}-${subject}-${createdAt}`
        if (existingSet.has(key)) continue

        // Insert new email
        const { error: insertError } = await supabase.from('emails').insert({
          user_id: user.id,
          from_email: fromEmail,
          from_name: fromName,
          to_email: settings.from_email || settings.imap_user,
          subject,
          body,
          is_read: false,
          is_starred: false,
          is_sent: false,
          is_deleted: false,
          created_at: createdAt,
        })

        if (!insertError) {
          newEmailsCount++
          existingSet.add(key)
        }
      } catch (parseError) {
        console.error('Error parsing email:', parseError)
      }
    }

    connection.end()

    return NextResponse.json({
      success: true,
      newEmails: newEmailsCount,
      message: newEmailsCount > 0
        ? `${newEmailsCount} nye emails hentet`
        : 'Ingen nye emails'
    })
  } catch (error: any) {
    console.error('Email fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Kunne ikke hente emails' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sendEmail, getSaelgerWelcomeEmail } from '@/lib/email/resend'

// Generate a random password
function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export async function POST(request: NextRequest) {
  try {
    // Auth check - only admins can create saelgere
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { email, full_name, phone, cpr_nr, commission_percent } = body

    if (!email || !full_name) {
      return NextResponse.json({ error: 'Email og navn er påkrævet' }, { status: 400 })
    }

    // Generate temp password
    const tempPassword = generatePassword()

    // Create user with Supabase Admin API
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Kunne ikke oprette bruger' }, { status: 500 })
    }

    // Create user profile in users table
    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email,
      full_name,
      phone: phone || null,
      cpr_nr: cpr_nr || null,
      commission_percent: commission_percent || 20,
      role: 'saelger',
      temp_password: tempPassword,
    })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Try to clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Send welcome email
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`
    try {
      await sendEmail({
        to: email,
        subject: 'Velkommen til Øresund Partners - Din konto er klar!',
        html: getSaelgerWelcomeEmail(full_name, tempPassword, loginUrl),
      })
    } catch (emailError) {
      console.error('Welcome email failed:', emailError)
      // Don't fail the whole operation if email fails
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email,
        full_name,
      },
    })
  } catch (error) {
    console.error('Create saelger error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

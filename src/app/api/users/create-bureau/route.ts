import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sendEmail, getBureauWelcomeEmail } from '@/lib/email/resend'

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
    // Auth check - only admins can create bureaus
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
    const { name, cvr_nr, contact_person, phone, email, website, commission_percent, logo_url } = body

    if (!name || !email || !contact_person || !cvr_nr) {
      return NextResponse.json({ error: 'Navn, email, kontaktperson og CVR er påkrævet' }, { status: 400 })
    }

    // Generate temp password
    const tempPassword = generatePassword()

    // Create user with Supabase Admin API
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Create auth user for bureau
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

    // Create user profile for bureau user
    const { error: userProfileError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email,
      full_name: contact_person,
      phone: phone || null,
      role: 'bureau',
      temp_password: tempPassword,
    })

    if (userProfileError) {
      console.error('User profile creation error:', userProfileError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: userProfileError.message }, { status: 500 })
    }

    // Create bureau entry
    const { data: bureauData, error: bureauError } = await supabaseAdmin.from('bureaus').insert({
      name,
      cvr_nr,
      contact_person,
      phone: phone || '',
      email,
      website: website || null,
      commission_percent: commission_percent || 30,
      logo_url: logo_url || null,
      user_id: authData.user.id,
      temp_password: tempPassword,
    }).select().single()

    if (bureauError) {
      console.error('Bureau creation error:', bureauError)
      // Try to clean up
      await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: bureauError.message }, { status: 500 })
    }

    // Update user with bureau_id
    await supabaseAdmin.from('users').update({ bureau_id: bureauData.id }).eq('id', authData.user.id)

    // Send welcome email
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`
    try {
      await sendEmail({
        to: email,
        subject: 'Velkommen til Øresund Partners - Din bureau-konto er klar!',
        html: getBureauWelcomeEmail(name, contact_person, tempPassword, loginUrl),
      })
    } catch (emailError) {
      console.error('Welcome email failed:', emailError)
      // Don't fail the whole operation if email fails
    }

    return NextResponse.json({
      success: true,
      bureau: bureauData,
    })
  } catch (error) {
    console.error('Create bureau error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

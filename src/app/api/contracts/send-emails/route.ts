import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Party {
  id: string
  name: string
  email: string
  identifier: string
  identifier_type: 'cvr' | 'cpr'
  public_link: string
  signed: boolean
  signed_at: string | null
  signature_data: string | null
}

export async function POST(request: NextRequest) {
  try {
    const { contractId, partyId } = await request.json()

    if (!contractId) {
      return NextResponse.json({ error: 'Contract ID required' }, { status: 400 })
    }

    // Fetch contract
    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single()

    if (error || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const parties = contract.parties as Party[]
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // If partyId is provided, only send to that party
    const partiesToEmail = partyId
      ? parties.filter((p) => p.id === partyId && !p.signed)
      : parties.filter((p) => !p.signed)

    if (partiesToEmail.length === 0) {
      return NextResponse.json({ error: 'No parties to email' }, { status: 400 })
    }

    let sent = 0
    const errors: string[] = []

    for (const party of partiesToEmail) {
      const contractUrl = `${baseUrl}/kontrakt/${party.public_link}`

      try {
        await resend.emails.send({
          from: 'Øresund Partners <kontrakter@oresundpartners.dk>',
          to: party.email,
          subject: `Underskrift påkrævet: ${contract.name}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Underskrift påkrævet</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                      <!-- Header -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px; text-align: center;">
                          <div style="width: 56px; height: 56px; background-color: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                            <span style="color: #ffffff; font-size: 28px; font-weight: bold;">Ø</span>
                          </div>
                          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Øresund Partners</h1>
                        </td>
                      </tr>

                      <!-- Content -->
                      <tr>
                        <td style="padding: 40px 32px;">
                          <h2 style="color: #111827; margin: 0 0 16px; font-size: 22px; font-weight: 600;">
                            Hej ${party.name},
                          </h2>
                          <p style="color: #4b5563; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                            Du er inviteret til at underskrive følgende kontrakt:
                          </p>

                          <!-- Contract Box -->
                          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                            <p style="color: #6b7280; margin: 0 0 4px; font-size: 14px;">Kontrakt</p>
                            <p style="color: #111827; margin: 0; font-size: 18px; font-weight: 600;">${contract.name}</p>
                          </div>

                          <p style="color: #4b5563; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                            Klik på knappen nedenfor for at læse og underskrive kontrakten. Dit unikke link er kun til dig og kan ikke deles.
                          </p>

                          <!-- CTA Button -->
                          <div style="text-align: center; margin-bottom: 24px;">
                            <a href="${contractUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                              Underskriv Kontrakt
                            </a>
                          </div>

                          <p style="color: #9ca3af; margin: 0; font-size: 14px; text-align: center;">
                            Eller kopier dette link: <a href="${contractUrl}" style="color: #6366f1; text-decoration: none;">${contractUrl}</a>
                          </p>
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
                          <p style="color: #6b7280; margin: 0; font-size: 14px; text-align: center;">
                            © ${new Date().getFullYear()} Øresund Partners. Alle rettigheder forbeholdes.
                          </p>
                          <p style="color: #9ca3af; margin: 8px 0 0; font-size: 12px; text-align: center;">
                            Denne email er sendt automatisk. Besvar venligst ikke denne email.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        })
        sent++
      } catch (emailError: any) {
        console.error(`Failed to send email to ${party.email}:`, emailError)
        errors.push(`${party.name}: ${emailError.message}`)
      }
    }

    if (sent === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: 'Failed to send emails', details: errors },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sent,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('Send emails error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

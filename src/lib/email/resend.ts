import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const EMAIL_FROM = 'Øresund Partners <noreply@oresundpartners.dk>'

export interface EmailTemplate {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailTemplate) {
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    })

    if (error) {
      console.error('Email send error:', error)
      throw new Error(error.message)
    }

    return data
  } catch (error) {
    console.error('Failed to send email:', error)
    throw error
  }
}

// Email templates
export function getContractInviteEmail(
  partyName: string,
  contractName: string,
  contractUrl: string
): string {
  return `
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
                    Hej ${partyName},
                  </h2>
                  <p style="color: #4b5563; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                    Du er inviteret til at underskrive følgende kontrakt:
                  </p>

                  <!-- Contract Box -->
                  <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="color: #6b7280; margin: 0 0 4px; font-size: 14px;">Kontrakt</p>
                    <p style="color: #111827; margin: 0; font-size: 18px; font-weight: 600;">${contractName}</p>
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
  `
}

export function getWelcomeEmail(userName: string, loginUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Velkommen til Øresund Partners</title>
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
                    Velkommen, ${userName}!
                  </h2>
                  <p style="color: #4b5563; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                    Din konto hos Øresund Partners er nu oprettet. Du kan logge ind på dit dashboard for at komme i gang.
                  </p>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin-bottom: 24px;">
                    <a href="${loginUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Gå til Dashboard
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; margin: 0; font-size: 14px; text-align: center;">
                    © ${new Date().getFullYear()} Øresund Partners. Alle rettigheder forbeholdes.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

export function getPasswordResetEmail(resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nulstil din adgangskode</title>
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
                    Nulstil din adgangskode
                  </h2>
                  <p style="color: #4b5563; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                    Vi har modtaget en anmodning om at nulstille din adgangskode. Klik på knappen nedenfor for at vælge en ny adgangskode.
                  </p>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin-bottom: 24px;">
                    <a href="${resetUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Nulstil Adgangskode
                    </a>
                  </div>

                  <p style="color: #9ca3af; margin: 0; font-size: 14px; text-align: center;">
                    Hvis du ikke har anmodet om denne nulstilling, kan du ignorere denne email.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; margin: 0; font-size: 14px; text-align: center;">
                    © ${new Date().getFullYear()} Øresund Partners. Alle rettigheder forbeholdes.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

export function getInvoiceEmail(
  customerName: string,
  invoiceNumber: string,
  amount: number,
  dueDate: string,
  invoiceUrl?: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ny faktura</title>
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
                    Hej ${customerName},
                  </h2>
                  <p style="color: #4b5563; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                    Her er din faktura fra Øresund Partners.
                  </p>

                  <!-- Invoice Box -->
                  <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="color: #6b7280; margin: 0; font-size: 14px;">Faktura nr.</p>
                          <p style="color: #111827; margin: 4px 0 0; font-size: 16px; font-weight: 600;">${invoiceNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="color: #6b7280; margin: 0; font-size: 14px;">Beløb</p>
                          <p style="color: #111827; margin: 4px 0 0; font-size: 24px; font-weight: 700;">${amount.toLocaleString('da-DK')} kr</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="color: #6b7280; margin: 0; font-size: 14px;">Forfaldsdato</p>
                          <p style="color: #111827; margin: 4px 0 0; font-size: 16px; font-weight: 600;">${dueDate}</p>
                        </td>
                      </tr>
                    </table>
                  </div>

                  ${invoiceUrl ? `
                  <!-- CTA Button -->
                  <div style="text-align: center; margin-bottom: 24px;">
                    <a href="${invoiceUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Se Faktura
                    </a>
                  </div>
                  ` : ''}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; margin: 0; font-size: 14px; text-align: center;">
                    © ${new Date().getFullYear()} Øresund Partners. Alle rettigheder forbeholdes.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

export function getBureauWelcomeEmail(
  bureauName: string,
  contactPerson: string,
  tempPassword: string,
  loginUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Velkommen til Øresund Partners</title>
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
                    Velkommen, ${contactPerson}!
                  </h2>
                  <p style="color: #4b5563; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                    Vi er glade for at byde ${bureauName} velkommen som samarbejdspartner hos Øresund Partners.
                  </p>
                  <p style="color: #4b5563; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                    Din konto er nu oprettet, og du kan logge ind med følgende oplysninger:
                  </p>

                  <!-- Credentials Box -->
                  <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="color: #6b7280; margin: 0 0 8px; font-size: 14px;">Midlertidig adgangskode:</p>
                    <p style="color: #111827; margin: 0; font-size: 18px; font-weight: 600; font-family: monospace; background: #e5e7eb; padding: 8px 12px; border-radius: 4px; display: inline-block;">${tempPassword}</p>
                  </div>

                  <p style="color: #ef4444; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
                    <strong>Vigtigt:</strong> Vi anbefaler at du ændrer din adgangskode efter første login.
                  </p>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin-bottom: 24px;">
                    <a href="${loginUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Log ind nu
                    </a>
                  </div>

                  <p style="color: #4b5563; margin: 0 0 16px; font-size: 16px; line-height: 1.6;">
                    I dit dashboard kan du:
                  </p>
                  <ul style="color: #4b5563; margin: 0 0 24px; padding-left: 20px; font-size: 16px; line-height: 1.8;">
                    <li>Se dine kunder og kampagner</li>
                    <li>Følge med i salgsstatistikker</li>
                    <li>Administrere dine fakturaer</li>
                    <li>Kommunikere med dit team</li>
                  </ul>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; margin: 0; font-size: 14px; text-align: center;">
                    © ${new Date().getFullYear()} Øresund Partners. Alle rettigheder forbeholdes.
                  </p>
                  <p style="color: #9ca3af; margin: 8px 0 0; font-size: 12px; text-align: center;">
                    Har du spørgsmål? Kontakt os på support@oresundpartners.dk
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

export function getSaelgerWelcomeEmail(
  fullName: string,
  tempPassword: string,
  loginUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Velkommen til Øresund Partners</title>
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
                    Velkommen til teamet, ${fullName}!
                  </h2>
                  <p style="color: #4b5563; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                    Vi er glade for at have dig med på holdet hos Øresund Partners. Din sælgerkonto er nu oprettet og klar til brug.
                  </p>

                  <!-- Credentials Box -->
                  <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="color: #6b7280; margin: 0 0 8px; font-size: 14px;">Din midlertidige adgangskode:</p>
                    <p style="color: #111827; margin: 0; font-size: 18px; font-weight: 600; font-family: monospace; background: #e5e7eb; padding: 8px 12px; border-radius: 4px; display: inline-block;">${tempPassword}</p>
                  </div>

                  <p style="color: #ef4444; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
                    <strong>Vigtigt:</strong> Skift din adgangskode efter første login for at sikre din konto.
                  </p>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin-bottom: 24px;">
                    <a href="${loginUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Log ind og kom i gang
                    </a>
                  </div>

                  <p style="color: #4b5563; margin: 0 0 16px; font-size: 16px; line-height: 1.6;">
                    Som sælger har du adgang til:
                  </p>
                  <ul style="color: #4b5563; margin: 0 0 24px; padding-left: 20px; font-size: 16px; line-height: 1.8;">
                    <li>Autodialer og opkaldssystem</li>
                    <li>Kampagner og kundelister</li>
                    <li>E-learning og uddannelse</li>
                    <li>AI-assistent til salgshjælp</li>
                    <li>Personlig salgsstatistik</li>
                  </ul>

                  <p style="color: #4b5563; margin: 0; font-size: 16px; line-height: 1.6;">
                    Vi glæder os til at se dig i aktion!
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
                    Spørgsmål? Kontakt din teamleder eller skriv til support@oresundpartners.dk
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

export function getNotificationEmail(
  userName: string,
  title: string,
  message: string,
  actionUrl?: string,
  actionText?: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
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
                    Hej ${userName},
                  </h2>
                  <p style="color: #4b5563; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                    ${message}
                  </p>

                  ${actionUrl && actionText ? `
                  <!-- CTA Button -->
                  <div style="text-align: center; margin-bottom: 24px;">
                    <a href="${actionUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      ${actionText}
                    </a>
                  </div>
                  ` : ''}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; margin: 0; font-size: 14px; text-align: center;">
                    © ${new Date().getFullYear()} Øresund Partners. Alle rettigheder forbeholdes.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ReactPDF, { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'

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

// Disable hyphenation to avoid font issues with special characters
Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#1f2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  logo: {
    width: 40,
    height: 40,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 700,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#111827',
  },
  contractTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 8,
  },
  date: {
    fontSize: 10,
    color: '#6b7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  content: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#4b5563',
  },
  partiesContainer: {
    marginTop: 30,
    marginBottom: 30,
  },
  partyBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  partyName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  partyDetail: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
  },
  signatureSection: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  signatureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  signatureBox: {
    width: '45%',
    marginBottom: 30,
  },
  signatureLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 8,
  },
  signatureImage: {
    width: 200,
    height: 80,
    objectFit: 'contain',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    width: 200,
    height: 60,
    marginBottom: 8,
  },
  signedInfo: {
    fontSize: 9,
    color: '#6b7280',
  },
  signedBadge: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 4,
  },
  unsignedBadge: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
})

// Sanitize text to remove problematic characters for PDF rendering
function sanitizeText(text: string): string {
  if (!text) return ''
  return text
    // Replace Danish special characters with ASCII equivalents for safety
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .replace(/å/g, 'aa')
    .replace(/Æ/g, 'Ae')
    .replace(/Ø/g, 'Oe')
    .replace(/Å/g, 'Aa')
    // Remove other problematic unicode characters
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u2026/g, '...')
    .replace(/[^\x00-\x7F]/g, '') // Remove any remaining non-ASCII
}

function stripHtml(html: string): string {
  if (!html) return ''
  // Simple HTML to text conversion
  const text = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '$1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '$1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '$1\n\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return sanitizeText(text)
}

function ContractPDF({ contract, parties }: { contract: any; parties: Party[] }) {
  const contentText = stripHtml(contract.content || '')
  const contractName = sanitizeText(contract.name || 'Kontrakt')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>O</Text>
            </View>
            <Text style={styles.companyName}>Oeresund Partners</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.date}>
              Oprettet: {new Date(contract.created_at).toLocaleDateString('da-DK')}
            </Text>
            {contract.signed_at && (
              <Text style={styles.date}>
                Underskrevet: {new Date(contract.signed_at).toLocaleDateString('da-DK')}
              </Text>
            )}
          </View>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.contractTitle}>{contractName}</Text>
        </View>

        {/* Content */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>KONTRAKTENS INDHOLD</Text>
          <Text style={styles.content}>{contentText}</Text>
        </View>

        {/* Parties */}
        <View style={styles.partiesContainer}>
          <Text style={styles.sectionTitle}>PARTER</Text>
          {parties.map((party) => (
            <View key={party.id} style={styles.partyBox}>
              <Text style={styles.partyName}>{sanitizeText(party.name || '')}</Text>
              <Text style={styles.partyDetail}>{party.email || ''}</Text>
              {party.identifier && (
                <Text style={styles.partyDetail}>
                  {(party.identifier_type || 'ID').toUpperCase()}: {party.identifier}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <Text style={styles.sectionTitle}>UNDERSKRIFTER</Text>
          <View style={styles.signatureGrid}>
            {parties.map((party) => (
              <View key={party.id} style={styles.signatureBox}>
                <Text style={styles.signatureLabel}>{sanitizeText(party.name || '')}</Text>
                {party.signature_data ? (
                  <>
                    <Image src={party.signature_data} style={styles.signatureImage} />
                    <Text style={styles.signedInfo}>
                      Underskrevet: {party.signed_at ? new Date(party.signed_at).toLocaleString('da-DK') : 'Ukendt'}
                    </Text>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={styles.signedBadge}>UNDERSKREVET</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.signatureLine} />
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={styles.unsignedBadge}>AFVENTER</Text>
                    </View>
                  </>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            (c) {new Date().getFullYear()} Oeresund Partners
          </Text>
          <Text style={styles.footerText}>
            Kontrakt ID: {contract.id}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch contract
    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const parties = contract.parties as Party[]

    // Generate PDF
    const pdfStream = await ReactPDF.renderToStream(
      <ContractPDF contract={contract} parties={parties} />
    )

    // Convert stream to buffer
    const chunks: Buffer[] = []
    for await (const chunk of pdfStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const pdfBuffer = Buffer.concat(chunks)

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${contract.name.replace(/[^a-zA-Z0-9æøåÆØÅ\s-]/g, '')}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role client to bypass RLS for public contract viewing
const supabaseAdmin = createClient(
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ link: string }> }
) {
  try {
    const { link } = await params

    if (!link) {
      return NextResponse.json({ error: 'Link required' }, { status: 400 })
    }

    // First try to find contract by public_link (backwards compatibility)
    let { data: contract } = await supabaseAdmin
      .from('contracts')
      .select('id, name, content, parties, status, created_at')
      .eq('public_link', link)
      .single()

    let currentParty: Party | null = null

    if (!contract) {
      // Search for contract by party's public_link
      const { data: allContracts } = await supabaseAdmin
        .from('contracts')
        .select('id, name, content, parties, status, created_at')

      if (allContracts) {
        for (const c of allContracts) {
          const parties = c.parties as Party[]
          const party = parties?.find((p) => p.public_link === link)
          if (party) {
            contract = c
            currentParty = party
            break
          }
        }
      }
    } else {
      // For backwards compatibility, find party by link
      const parties = contract.parties as Party[]
      currentParty = parties?.find((p) => p.public_link === link) || parties?.[0] || null
    }

    if (!contract || !currentParty) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // Return contract data without sensitive info
    return NextResponse.json({
      contract: {
        id: contract.id,
        name: contract.name,
        content: contract.content,
        parties: contract.parties,
        status: contract.status,
      },
      currentParty: {
        id: currentParty.id,
        name: currentParty.name,
        email: currentParty.email,
        identifier: currentParty.identifier,
        identifier_type: currentParty.identifier_type,
        signed: currentParty.signed,
        signed_at: currentParty.signed_at,
      },
    })
  } catch (error: any) {
    console.error('Public contract fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST to sign the contract
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ link: string }> }
) {
  try {
    const { link } = await params
    const { signatureData } = await request.json()

    if (!link || !signatureData) {
      return NextResponse.json(
        { error: 'Link and signature required' },
        { status: 400 }
      )
    }

    // Find contract by party's public_link
    const { data: allContracts } = await supabaseAdmin
      .from('contracts')
      .select('*')

    let contract = null
    let currentParty: Party | null = null

    if (allContracts) {
      for (const c of allContracts) {
        const parties = c.parties as Party[]
        const party = parties?.find((p) => p.public_link === link)
        if (party) {
          contract = c
          currentParty = party
          break
        }
      }
    }

    if (!contract || !currentParty) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    if (currentParty.signed) {
      return NextResponse.json(
        { error: 'Contract already signed' },
        { status: 400 }
      )
    }

    // Get IP address
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // Update the party's signature
    const updatedParties = (contract.parties as Party[]).map((party) =>
      party.id === currentParty!.id
        ? {
            ...party,
            signed: true,
            signed_at: new Date().toISOString(),
            signature_data: signatureData,
          }
        : party
    )

    // Check if all parties have signed
    const allSigned = updatedParties.every((p) => p.signed)

    const { error } = await supabaseAdmin
      .from('contracts')
      .update({
        parties: updatedParties,
        status: allSigned ? 'underskrevet' : 'afventer',
        ...(allSigned && {
          signed_at: new Date().toISOString(),
          signer_ip: ip,
          signer_name: currentParty.name,
        }),
      })
      .eq('id', contract.id)

    if (error) {
      console.error('Contract update error:', error)
      return NextResponse.json(
        { error: 'Failed to sign contract' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      allSigned,
      signedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Contract sign error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

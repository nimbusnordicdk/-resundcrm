'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import SignatureCanvas from 'react-signature-canvas'
import { Button } from '@/components/ui'
import { CheckCircle, AlertCircle, FileText, X, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Contract } from '@/types/database'

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

export default function KontraktPage() {
  const params = useParams()
  const [contract, setContract] = useState<Contract | null>(null)
  const [currentParty, setCurrentParty] = useState<Party | null>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const signatureRef = useRef<SignatureCanvas>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchContract()
  }, [params.link])

  async function fetchContract() {
    // First, try to find the contract where public_link matches (backwards compatibility)
    let { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('public_link', params.link)
      .single()

    if (error || !data) {
      // If not found, search for the contract by party's public_link
      const { data: allContracts } = await supabase
        .from('contracts')
        .select('*')

      if (allContracts) {
        for (const c of allContracts) {
          const parties = c.parties as Party[]
          const party = parties?.find((p) => p.public_link === params.link)
          if (party) {
            data = c
            setCurrentParty(party)
            if (party.signed) {
              setSigned(true)
            }
            break
          }
        }
      }
    } else {
      // For backwards compatibility, use first party
      const parties = data.parties as Party[]
      if (parties?.length > 0) {
        const party = parties.find((p) => p.public_link === params.link) || parties[0]
        setCurrentParty(party)
        if (party.signed) {
          setSigned(true)
        }
      }
    }

    setContract(data || null)
    setLoading(false)
  }

  function clearSignature() {
    signatureRef.current?.clear()
  }

  async function submitSignature() {
    if (!contract || !currentParty) return
    if (signatureRef.current?.isEmpty()) {
      toast.error('Tegn venligst din underskrift')
      return
    }

    setSigning(true)

    try {
      // Hent IP adresse
      const ipResponse = await fetch('https://api.ipify.org?format=json')
      const { ip } = await ipResponse.json()

      const signatureData = signatureRef.current?.toDataURL()

      // Update the party's signature in the parties array
      const updatedParties = (contract.parties as Party[]).map((party) =>
        party.id === currentParty.id
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

      const { error } = await supabase
        .from('contracts')
        .update({
          parties: updatedParties,
          status: allSigned ? 'underskrevet' : 'afventer',
          // Only update these if all signed (for PDF generation)
          ...(allSigned && {
            signed_at: new Date().toISOString(),
            signer_ip: ip,
            signer_name: currentParty.name,
          }),
        })
        .eq('id', contract.id)

      if (error) throw error

      setSigned(true)
      toast.success('Kontrakt underskrevet!')
    } catch (error) {
      toast.error('Kunne ikke underskrive kontrakt')
    } finally {
      setSigning(false)
    }
  }

  function getOtherPartiesStatus(): { total: number; signed: number } {
    if (!contract) return { total: 0, signed: 0 }
    const parties = contract.parties as Party[]
    const otherParties = parties?.filter((p) => p.id !== currentParty?.id) || []
    return {
      total: otherParties.length,
      signed: otherParties.filter((p) => p.signed).length,
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!contract || !currentParty) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-danger mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Kontrakt ikke fundet</h1>
          <p className="text-gray-500 dark:text-gray-400">Dette link er ugyldigt eller udløbet.</p>
        </div>
      </div>
    )
  }

  if (signed) {
    const otherStatus = getOtherPartiesStatus()
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <CheckCircle className="w-20 h-20 text-success mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Tak for din underskrift!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Kontrakten "{contract.name}" er nu underskrevet af dig.
          </p>
          <div className="card p-4 text-left">
            <p className="text-sm text-gray-500 dark:text-gray-400">Underskrevet af</p>
            <p className="text-gray-900 dark:text-white font-medium">
              {currentParty.name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Email</p>
            <p className="text-gray-900 dark:text-white font-medium">
              {currentParty.email}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Tidspunkt</p>
            <p className="text-gray-900 dark:text-white font-medium">
              {currentParty.signed_at
                ? new Date(currentParty.signed_at).toLocaleString('da-DK')
                : new Date().toLocaleString('da-DK')}
            </p>
            {otherStatus.total > 0 && (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Andre parter</p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {otherStatus.signed}/{otherStatus.total} har underskrevet
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const otherStatus = getOtherPartiesStatus()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      {/* Header */}
      <header className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">Ø</span>
            </div>
            <span className="text-gray-900 dark:text-white font-semibold">Øresund Partners</span>
          </div>
          <span className="text-gray-500 dark:text-gray-400 text-sm">Kontraktrum</span>
        </div>
      </header>

      {/* Welcome Banner */}
      <div className="bg-primary-50 dark:bg-primary-600/10 border-b border-primary-200 dark:border-primary-600/30">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Velkommen, {currentParty.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Du er inviteret til at underskrive følgende kontrakt. Læs venligst
            kontrakten igennem og underskriv nederst.
          </p>
        </div>
      </div>

      {/* Contract Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="card">
          {/* Contract Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary-500 dark:text-primary-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{contract.name}</h2>
          </div>

          {/* Contract Body */}
          <div className="p-6">
            <div
              className="wysiwyg-editor prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: contract.content }}
            />
          </div>

          {/* Parties */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-hover/50">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Parter i kontrakten</h3>
            </div>
            <div className="space-y-2">
              {(contract.parties as Party[])?.map((party) => (
                <div key={party.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-gray-900 dark:text-white ${party.id === currentParty.id ? 'font-semibold' : ''}`}>
                      {party.name}
                      {party.id === currentParty.id && (
                        <span className="text-primary-600 dark:text-primary-400 text-sm ml-2">(dig)</span>
                      )}
                    </span>
                    {party.identifier && (
                      <span className="text-gray-500 text-sm">
                        ({party.identifier_type?.toUpperCase()}: {party.identifier})
                      </span>
                    )}
                  </div>
                  {party.signed ? (
                    <span className="badge-success">Underskrevet</span>
                  ) : (
                    <span className="badge-warning">Afventer</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="card mt-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Din Underskrift</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Tegn din underskrift i feltet nedenfor for at underskrive som {currentParty.name}
            </p>
          </div>

          <div className="p-6">
            <div className="border-2 border-gray-200 dark:border-dark-border rounded-lg overflow-hidden bg-white">
              <SignatureCanvas
                ref={signatureRef}
                penColor="black"
                canvasProps={{
                  className: 'w-full h-48',
                  style: { width: '100%', height: '192px' },
                }}
              />
            </div>

            <div className="flex items-center justify-between mt-4">
              <Button variant="ghost" icon={<X className="w-4 h-4" />} onClick={clearSignature}>
                Ryd underskrift
              </Button>
              <Button onClick={submitSignature} loading={signing} size="lg">
                Underskriv Kontrakt
              </Button>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              Ved at underskrive accepterer du kontraktens vilkår. Din IP-adresse
              og tidspunkt vil blive logget som bevis.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-dark-border mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} Øresund Partners. Alle rettigheder forbeholdes.
        </div>
      </footer>
    </div>
  )
}

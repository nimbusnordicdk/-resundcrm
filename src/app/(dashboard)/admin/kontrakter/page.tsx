'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import {
  Card,
  CardContent,
  Button,
  Modal,
  ModalFooter,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  Input,
  ContractStatusBadge,
} from '@/components/ui'
import { WYSIWYGEditor } from '@/components/forms/WYSIWYGEditor'
import { Plus, FileText, Search, Download, ExternalLink, Copy, X, Mail, Send, Eye, Users } from 'lucide-react'
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

export default function KontrakterPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    content: '',
  })
  const [parties, setParties] = useState<Party[]>([
    {
      id: uuidv4(),
      name: '',
      email: '',
      identifier: '',
      identifier_type: 'cvr',
      public_link: uuidv4(),
      signed: false,
      signed_at: null,
      signature_data: null,
    },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [sendingEmails, setSendingEmails] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchContracts()
  }, [])

  async function fetchContracts() {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Kunne ikke hente kontrakter')
    } else {
      setContracts(data || [])
    }
    setLoading(false)
  }

  function addParty() {
    setParties([
      ...parties,
      {
        id: uuidv4(),
        name: '',
        email: '',
        identifier: '',
        identifier_type: 'cvr',
        public_link: uuidv4(),
        signed: false,
        signed_at: null,
        signature_data: null,
      },
    ])
  }

  function removeParty(id: string) {
    if (parties.length === 1) {
      toast.error('Der skal være mindst én part')
      return
    }
    setParties(parties.filter((p) => p.id !== id))
  }

  function updateParty(id: string, field: keyof Party, value: string) {
    setParties(
      parties.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      )
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    // Validate parties
    for (const party of parties) {
      if (!party.name.trim()) {
        toast.error('Alle parter skal have et navn')
        setSubmitting(false)
        return
      }
      if (!party.email.trim()) {
        toast.error('Alle parter skal have en email')
        setSubmitting(false)
        return
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: contract, error } = await supabase.from('contracts').insert({
        name: formData.name,
        content: formData.content,
        parties: parties.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          identifier: p.identifier || null,
          identifier_type: p.identifier_type,
          public_link: p.public_link,
          signed: false,
          signed_at: null,
          signature_data: null,
        })),
        created_by: user?.id,
        public_link: parties[0].public_link, // Keep for backwards compatibility
        status: 'afventer',
      }).select().single()

      if (error) throw error

      toast.success('Kontrakt oprettet!')
      setShowModal(false)
      resetForm()
      fetchContracts()
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke oprette kontrakt')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      content: '',
    })
    setParties([
      {
        id: uuidv4(),
        name: '',
        email: '',
        identifier: '',
        identifier_type: 'cvr',
        public_link: uuidv4(),
        signed: false,
        signed_at: null,
        signature_data: null,
      },
    ])
  }

  function copyLink(publicLink: string) {
    const url = `${window.location.origin}/kontrakt/${publicLink}`
    navigator.clipboard.writeText(url)
    toast.success('Link kopieret!')
  }

  async function sendContractEmails(contract: Contract) {
    setSendingEmails(true)
    try {
      const response = await fetch('/api/contracts/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunne ikke sende emails')
      }

      const data = await response.json()
      toast.success(`${data.sent} emails sendt!`)
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke sende emails')
    } finally {
      setSendingEmails(false)
    }
  }

  async function sendEmailToParty(contract: Contract, party: Party) {
    try {
      const response = await fetch('/api/contracts/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract.id,
          partyId: party.id,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunne ikke sende email')
      }

      toast.success(`Email sendt til ${party.name}!`)
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke sende email')
    }
  }

  async function downloadPdf(contract: Contract) {
    try {
      const response = await fetch(`/api/contracts/${contract.id}/pdf`)
      if (!response.ok) throw new Error('Kunne ikke generere PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${contract.name}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke downloade PDF')
    }
  }

  function openContractDetails(contract: Contract) {
    setSelectedContract(contract)
    setShowDetailsModal(true)
  }

  function getSignedCount(contract: Contract): { signed: number; total: number } {
    const contractParties = contract.parties as Party[]
    const signed = contractParties?.filter((p) => p.signed).length || 0
    const total = contractParties?.length || 0
    return { signed, total }
  }

  function isFullySigned(contract: Contract): boolean {
    const { signed, total } = getSignedCount(contract)
    return signed === total && total > 0
  }

  const filteredContracts = contracts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.parties as Party[])?.some((p) =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kontraktrum</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Administrer kontrakter</p>
        </div>
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowModal(true)}
        >
          Opret Kontrakt
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Søg efter kontrakt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kontraktnavn</TableHead>
              <TableHead>Parter</TableHead>
              <TableHead>Underskrifter</TableHead>
              <TableHead>Dato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                    Indlæser...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredContracts.length === 0 ? (
              <TableEmpty message="Ingen kontrakter fundet" />
            ) : (
              filteredContracts.map((contract) => {
                const { signed, total } = getSignedCount(contract)
                return (
                  <TableRow key={contract.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-600/20 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{contract.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700 dark:text-gray-300">{total} parter</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${signed === total ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                        {signed}/{total}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-700 dark:text-gray-300">
                      {new Date(contract.created_at).toLocaleDateString('da-DK')}
                    </TableCell>
                    <TableCell>
                      <ContractStatusBadge status={isFullySigned(contract) ? 'underskrevet' : contract.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Eye className="w-4 h-4" />}
                          onClick={() => openContractDetails(contract)}
                          title="Se detaljer"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Send className="w-4 h-4" />}
                          onClick={() => sendContractEmails(contract)}
                          loading={sendingEmails}
                          title="Send emails til alle parter"
                        />
                        {isFullySigned(contract) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Download className="w-4 h-4" />}
                            onClick={() => downloadPdf(contract)}
                            title="Download PDF"
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Contract Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Opret Ny Kontrakt"
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Kontraktnavn"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Indtast kontraktnavn"
          />

          {/* Parties */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Parter</label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={addParty}
              >
                Tilføj Part
              </Button>
            </div>

            <div className="space-y-4">
              {parties.map((party, index) => (
                <div
                  key={party.id}
                  className="p-4 border border-gray-200 dark:border-dark-border rounded-lg bg-gray-50 dark:bg-dark-hover/50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Part {index + 1}
                    </span>
                    {parties.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeParty(party.id)}
                        className="p-1 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Navn"
                      value={party.name}
                      onChange={(e) => updateParty(party.id, 'name', e.target.value)}
                      required
                      placeholder="Fulde navn eller virksomhedsnavn"
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={party.email}
                      onChange={(e) => updateParty(party.id, 'email', e.target.value)}
                      required
                      placeholder="email@eksempel.dk"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="label">Type</label>
                      <select
                        className="input"
                        value={party.identifier_type}
                        onChange={(e) =>
                          updateParty(party.id, 'identifier_type', e.target.value)
                        }
                      >
                        <option value="cvr">CVR Nr</option>
                        <option value="cpr">CPR Nr</option>
                      </select>
                    </div>
                    <Input
                      label={party.identifier_type === 'cvr' ? 'CVR Nr' : 'CPR Nr'}
                      value={party.identifier}
                      onChange={(e) => updateParty(party.id, 'identifier', e.target.value)}
                      placeholder={party.identifier_type === 'cvr' ? '12345678' : '123456-1234'}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Kontrakt Indhold</label>
            <WYSIWYGEditor
              content={formData.content}
              onChange={(content) => setFormData({ ...formData, content })}
              placeholder="Skriv kontraktens indhold her..."
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
            >
              Annuller
            </Button>
            <Button type="submit" loading={submitting}>
              Opret Kontrakt
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Contract Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Kontrakt Detaljer"
        size="lg"
      >
        {selectedContract && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {selectedContract.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Oprettet {new Date(selectedContract.created_at).toLocaleDateString('da-DK')}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Parter</h4>
              <div className="space-y-3">
                {(selectedContract.parties as Party[])?.map((party) => (
                  <div
                    key={party.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-dark-border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white">{party.name}</p>
                        {party.signed ? (
                          <span className="badge-success">Underskrevet</span>
                        ) : (
                          <span className="badge-warning">Afventer</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{party.email}</p>
                      {party.identifier && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {party.identifier_type.toUpperCase()}: {party.identifier}
                        </p>
                      )}
                      {party.signed_at && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Underskrevet {new Date(party.signed_at).toLocaleString('da-DK')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Copy className="w-4 h-4" />}
                        onClick={() => copyLink(party.public_link)}
                        title="Kopier link"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ExternalLink className="w-4 h-4" />}
                        onClick={() => window.open(`/kontrakt/${party.public_link}`, '_blank')}
                        title="Åbn link"
                      />
                      {!party.signed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Mail className="w-4 h-4" />}
                          onClick={() => sendEmailToParty(selectedContract, party)}
                          title="Send email"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isFullySigned(selectedContract) && (
              <div className="flex justify-end">
                <Button
                  icon={<Download className="w-4 h-4" />}
                  onClick={() => downloadPdf(selectedContract)}
                >
                  Download PDF
                </Button>
              </div>
            )}
          </div>
        )}

        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
            Luk
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

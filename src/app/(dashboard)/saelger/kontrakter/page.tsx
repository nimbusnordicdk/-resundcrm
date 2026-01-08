'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
import { Plus, FileText, Search, Download, ExternalLink, Copy, Building2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Contract, Bureau } from '@/types/database'

interface PartyOption {
  id: string
  name: string
  identifier: string
  identifier_type: 'cvr' | 'cpr'
  type: 'bureau' | 'oresund' | 'custom'
}

export default function SaelgerKontrakterPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [bureaus, setBureaus] = useState<Bureau[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [partySource, setPartySource] = useState<'custom' | 'bureau' | 'oresund'>('custom')
  const [selectedBureauId, setSelectedBureauId] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    partyName: '',
    partyIdentifier: '',
    partyIdentifierType: 'cvr' as 'cvr' | 'cpr',
    content: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  // Øresund Partners info
  const oresundParty: PartyOption = {
    id: 'oresund',
    name: 'Øresund Partners ApS',
    identifier: '12345678', // Replace with actual CVR
    identifier_type: 'cvr',
    type: 'oresund',
  }

  useEffect(() => {
    fetchContracts()
    fetchBureaus()
  }, [])

  async function fetchBureaus() {
    const { data } = await supabase
      .from('bureaus')
      .select('*')
      .order('name')

    setBureaus(data || [])
  }

  async function fetchContracts() {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('created_by', user?.id)
      .order('created_at', { ascending: false })

    if (!error) {
      setContracts(data || [])
    }
    setLoading(false)
  }

  function getSelectedParty() {
    if (partySource === 'oresund') {
      return {
        name: oresundParty.name,
        identifier: oresundParty.identifier,
        identifier_type: oresundParty.identifier_type,
      }
    } else if (partySource === 'bureau' && selectedBureauId) {
      const bureau = bureaus.find(b => b.id === selectedBureauId)
      if (bureau) {
        return {
          name: bureau.name,
          identifier: bureau.cvr_nr,
          identifier_type: 'cvr' as const,
        }
      }
    }
    return {
      name: formData.partyName,
      identifier: formData.partyIdentifier || null,
      identifier_type: formData.partyIdentifierType,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const publicLink = uuidv4()
      const party = getSelectedParty()

      if (!party.name) {
        toast.error('Vælg eller indtast en part')
        setSubmitting(false)
        return
      }

      const { error } = await supabase.from('contracts').insert({
        name: formData.name,
        content: formData.content,
        parties: [party],
        created_by: user?.id,
        public_link: publicLink,
        status: 'afventer',
      })

      if (error) throw error

      toast.success('Kontrakt oprettet!')
      setShowModal(false)
      setFormData({
        name: '',
        partyName: '',
        partyIdentifier: '',
        partyIdentifierType: 'cvr',
        content: '',
      })
      setPartySource('custom')
      setSelectedBureauId('')
      fetchContracts()
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke oprette kontrakt')
    } finally {
      setSubmitting(false)
    }
  }

  function copyLink(publicLink: string) {
    const url = `${window.location.origin}/kontrakt/${publicLink}`
    navigator.clipboard.writeText(url)
    toast.success('Link kopieret!')
  }

  const filteredContracts = contracts.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kontrakter</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Mine kontrakter</p>
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
              <TableHead>Dato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                    Indlæser...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredContracts.length === 0 ? (
              <TableEmpty message="Ingen kontrakter fundet" />
            ) : (
              filteredContracts.map((contract) => (
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
                    {(contract.parties as any[])?.map((p) => p.name).join(', ') || '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(contract.created_at).toLocaleDateString('da-DK')}
                  </TableCell>
                  <TableCell>
                    <ContractStatusBadge status={contract.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Copy className="w-4 h-4" />}
                        onClick={() => copyLink(contract.public_link)}
                        title="Kopier link"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ExternalLink className="w-4 h-4" />}
                        onClick={() =>
                          window.open(`/kontrakt/${contract.public_link}`, '_blank')
                        }
                        title="Åbn kontrakt"
                      />
                      {contract.status === 'underskrevet' && contract.pdf_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Download className="w-4 h-4" />}
                          onClick={() => window.open(contract.pdf_url!, '_blank')}
                          title="Download PDF"
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Kontraktnavn"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Indtast kontraktnavn"
          />

          {/* Party Source Selector */}
          <div>
            <label className="label">Vælg part</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setPartySource('oresund')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  partySource === 'oresund'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <span className="text-primary-600 dark:text-primary-400 font-bold text-sm">Ø</span>
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Øresund Partners</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPartySource('bureau')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  partySource === 'bureau'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Vælg Bureau</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPartySource('custom')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  partySource === 'custom'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Indtast Selv</span>
                </div>
              </button>
            </div>

            {/* Øresund Partners selected - show info */}
            {partySource === 'oresund' && (
              <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <span className="text-primary-600 dark:text-primary-400 font-bold">Ø</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{oresundParty.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">CVR: {oresundParty.identifier}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Bureau selector */}
            {partySource === 'bureau' && (
              <div>
                <select
                  className="input"
                  value={selectedBureauId}
                  onChange={(e) => setSelectedBureauId(e.target.value)}
                  required={partySource === 'bureau'}
                >
                  <option value="">Vælg et bureau...</option>
                  {bureaus.map((bureau) => (
                    <option key={bureau.id} value={bureau.id}>
                      {bureau.name} (CVR: {bureau.cvr_nr})
                    </option>
                  ))}
                </select>
                {selectedBureauId && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>{bureaus.find(b => b.id === selectedBureauId)?.name}</strong> vil blive tilføjet som part
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Custom party input */}
            {partySource === 'custom' && (
              <div className="space-y-4">
                <Input
                  label="Part Navn"
                  value={formData.partyName}
                  onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
                  required={partySource === 'custom'}
                  placeholder="Fulde navn eller virksomhedsnavn"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Type</label>
                    <select
                      className="input"
                      value={formData.partyIdentifierType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          partyIdentifierType: e.target.value as 'cvr' | 'cpr',
                        })
                      }
                    >
                      <option value="cvr">CVR Nr</option>
                      <option value="cpr">CPR Nr</option>
                    </select>
                  </div>
                  <Input
                    label={formData.partyIdentifierType === 'cvr' ? 'CVR Nr' : 'CPR Nr'}
                    value={formData.partyIdentifier}
                    onChange={(e) =>
                      setFormData({ ...formData, partyIdentifier: e.target.value })
                    }
                    placeholder={formData.partyIdentifierType === 'cvr' ? '12345678' : '123456-1234'}
                  />
                </div>
              </div>
            )}
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
    </div>
  )
}

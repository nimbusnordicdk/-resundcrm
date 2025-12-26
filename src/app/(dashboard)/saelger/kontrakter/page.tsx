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
import { Plus, FileText, Search, Download, ExternalLink, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Contract } from '@/types/database'

export default function SaelgerKontrakterPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    partyName: '',
    partyIdentifier: '',
    partyIdentifierType: 'cvr' as 'cvr' | 'cpr',
    content: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchContracts()
  }, [])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const publicLink = uuidv4()

      const { error } = await supabase.from('contracts').insert({
        name: formData.name,
        content: formData.content,
        parties: [
          {
            name: formData.partyName,
            identifier: formData.partyIdentifier || null,
            identifier_type: formData.partyIdentifierType,
          },
        ],
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

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Part Navn"
              value={formData.partyName}
              onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
              required
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

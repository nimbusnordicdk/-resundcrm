'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardHeader,
  CardTitle,
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
} from '@/components/ui'
import { Plus, Building2, Search, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Bureau } from '@/types/database'

export default function BureauerPage() {
  const [bureaus, setBureaus] = useState<Bureau[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    cvr_nr: '',
    contact_person: '',
    phone: '',
    email: '',
    website: '',
    commission_percent: '30',
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchBureaus()
  }, [])

  async function fetchBureaus() {
    const { data, error } = await supabase
      .from('bureaus')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Kunne ikke hente bureauer')
    } else {
      setBureaus(data || [])
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      let logo_url = null

      // Upload logo if provided
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, logoFile)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('logos')
          .getPublicUrl(fileName)

        logo_url = urlData.publicUrl
      }

      const { error } = await supabase.from('bureaus').insert({
        name: formData.name,
        cvr_nr: formData.cvr_nr,
        contact_person: formData.contact_person,
        phone: formData.phone,
        email: formData.email,
        website: formData.website || null,
        commission_percent: parseFloat(formData.commission_percent),
        logo_url,
      })

      if (error) throw error

      toast.success('Bureau oprettet!')
      setShowModal(false)
      setFormData({
        name: '',
        cvr_nr: '',
        contact_person: '',
        phone: '',
        email: '',
        website: '',
        commission_percent: '30',
      })
      setLogoFile(null)
      fetchBureaus()
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke oprette bureau')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredBureaus = bureaus.filter(
    (bureau) =>
      bureau.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bureau.cvr_nr.includes(searchTerm) ||
      bureau.contact_person.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alle Bureauer</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Administrer marketingbureauer</p>
        </div>
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowModal(true)}
        >
          Tilføj Bureau
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Søg efter bureau..."
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
              <TableHead>Bureau</TableHead>
              <TableHead>CVR Nr</TableHead>
              <TableHead>Kontaktperson</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Kommission %</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                    Indlæser...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredBureaus.length === 0 ? (
              <TableEmpty message="Ingen bureauer fundet" />
            ) : (
              filteredBureaus.map((bureau) => (
                <TableRow
                  key={bureau.id}
                  onClick={() => router.push(`/admin/bureauer/${bureau.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {bureau.logo_url ? (
                        <img
                          src={bureau.logo_url}
                          alt={bureau.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-hover flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">{bureau.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{bureau.cvr_nr}</TableCell>
                  <TableCell>{bureau.contact_person}</TableCell>
                  <TableCell>{bureau.phone}</TableCell>
                  <TableCell>{bureau.email}</TableCell>
                  <TableCell>{bureau.commission_percent}%</TableCell>
                  <TableCell>
                    {bureau.website && (
                      <a
                        href={bureau.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors inline-flex"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add Bureau Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Tilføj Nyt Bureau"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Bureau Navn"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Indtast bureau navn"
          />

          <Input
            label="CVR Nr"
            value={formData.cvr_nr}
            onChange={(e) => setFormData({ ...formData, cvr_nr: e.target.value })}
            required
            placeholder="12345678"
          />

          <div>
            <label className="label">Upload Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="input py-2"
            />
          </div>

          <Input
            label="Kontaktperson"
            value={formData.contact_person}
            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
            required
            placeholder="Fulde navn"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Telefon Nr"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              placeholder="+45 12 34 56 78"
            />

            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="email@bureau.dk"
            />
          </div>

          <Input
            label="Hjemmeside"
            type="url"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            placeholder="https://www.bureau.dk"
          />

          <Input
            label="Kommission %"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={formData.commission_percent}
            onChange={(e) => setFormData({ ...formData, commission_percent: e.target.value })}
            required
          />

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
            >
              Annuller
            </Button>
            <Button type="submit" loading={submitting}>
              Opret Bureau
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  )
}

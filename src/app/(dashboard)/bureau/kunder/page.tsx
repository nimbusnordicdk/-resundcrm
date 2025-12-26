'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  CustomerStatusBadge,
  Button,
  Modal,
  ModalFooter,
  TextArea,
} from '@/components/ui'
import { Search, CheckCircle, XCircle, Ban, Upload, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Customer } from '@/types/database'

export default function BureauKunderPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showTerminationModal, setShowTerminationModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [terminationReason, setTerminationReason] = useState('')
  const [terminationFile, setTerminationFile] = useState<File | null>(null)
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    const { data: userData } = await supabase
      .from('users')
      .select('bureau_id')
      .eq('id', user?.id)
      .single()

    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        saelger:users!customers_saelger_id_fkey(full_name)
      `)
      .eq('bureau_id', userData?.bureau_id)
      .order('created_at', { ascending: false })

    if (!error) {
      setCustomers(data || [])
    } else {
      console.error('Fetch customers error:', error)
    }
    setLoading(false)
  }

  async function confirmCustomer(customerId: string) {
    const { error } = await supabase
      .from('customers')
      .update({ status: 'aktiv' })
      .eq('id', customerId)

    if (error) {
      toast.error('Kunne ikke bekræfte kunde')
    } else {
      toast.success('Kunde bekræftet!')
      fetchCustomers()
    }
  }

  async function rejectCustomer(customerId: string) {
    // Find lead og opdater status
    const customer = customers.find((c) => c.id === customerId)
    if (customer?.lead_id) {
      await supabase
        .from('leads')
        .update({ status: 'bureau_afvist' })
        .eq('id', customer.lead_id)
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId)

    if (error) {
      toast.error('Kunne ikke afvise kunde')
    } else {
      toast.success('Kunde afvist')
      fetchCustomers()
    }
  }

  function openTerminationModal(customer: any) {
    setSelectedCustomer(customer)
    setTerminationReason('')
    setTerminationFile(null)
    setDeclarationAccepted(false)
    setShowTerminationModal(true)
  }

  async function handleTermination() {
    if (!selectedCustomer || !terminationReason || !terminationFile || !declarationAccepted) {
      toast.error('Udfyld alle felter og accepter erklæringen')
      return
    }

    setSubmitting(true)

    try {
      // Upload dokumentation
      const fileExt = terminationFile.name.split('.').pop()
      const fileName = `terminations/${selectedCustomer.id}/${Date.now()}.${fileExt}`

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('documents')
        .upload(fileName, terminationFile)

      if (uploadError) {
        throw new Error('Kunne ikke uploade dokumentation')
      }

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName)

      // Opdater kunde
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          status: 'opsagt',
          terminated_at: new Date().toISOString(),
          termination_reason: terminationReason,
          termination_document_url: publicUrl,
          termination_declared_by: currentUserId,
        })
        .eq('id', selectedCustomer.id)

      if (updateError) {
        throw new Error('Kunne ikke opsige kunde')
      }

      toast.success('Kunde opsagt')
      setShowTerminationModal(false)
      fetchCustomers()
    } catch (error: any) {
      toast.error(error.message || 'Der opstod en fejl')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pendingCustomers = filteredCustomers.filter(
    (c) => c.status === 'afventer_bekraeftelse'
  )
  const activeCustomers = filteredCustomers.filter((c) => c.status === 'aktiv')
  const terminatedCustomers = filteredCustomers.filter((c) => c.status === 'opsagt')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alle Kunder</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Administrer dine kunder</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Søg efter kunde..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pending Confirmations */}
      {pendingCustomers.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-warning">
              Afventer Bekræftelse ({pendingCustomers.length})
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kunde</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Sælger</TableHead>
                <TableHead>Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium text-gray-900 dark:text-white">
                    {customer.name}
                  </TableCell>
                  <TableCell>{customer.email || '-'}</TableCell>
                  <TableCell>{customer.phone || '-'}</TableCell>
                  <TableCell>{customer.saelger?.full_name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        icon={<CheckCircle className="w-4 h-4" />}
                        onClick={() => confirmCustomer(customer.id)}
                      >
                        Bekræft
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<XCircle className="w-4 h-4" />}
                        onClick={() => rejectCustomer(customer.id)}
                      >
                        Afvis
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Active Customers */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Aktive Kunder ({activeCustomers.length})
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kunde</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Sælger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Oprettet</TableHead>
              <TableHead>Handlinger</TableHead>
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
            ) : activeCustomers.length === 0 ? (
              <TableEmpty message="Ingen aktive kunder" />
            ) : (
              activeCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium text-gray-900 dark:text-white">
                    {customer.name}
                  </TableCell>
                  <TableCell>{customer.email || '-'}</TableCell>
                  <TableCell>{customer.phone || '-'}</TableCell>
                  <TableCell>{customer.saelger?.full_name || '-'}</TableCell>
                  <TableCell>
                    <CustomerStatusBadge status={customer.status} />
                  </TableCell>
                  <TableCell>
                    {new Date(customer.created_at).toLocaleDateString('da-DK')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Ban className="w-4 h-4" />}
                      onClick={() => openTerminationModal(customer)}
                    >
                      Opsig
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Terminated Customers */}
      {terminatedCustomers.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-gray-500 dark:text-gray-400">
              Opsagte Kunder ({terminatedCustomers.length})
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kunde</TableHead>
                <TableHead>Opsagt Dato</TableHead>
                <TableHead>Årsag</TableHead>
                <TableHead>Erklæret af</TableHead>
                <TableHead>Dokumentation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terminatedCustomers.map((customer) => (
                <TableRow key={customer.id} className="opacity-60">
                  <TableCell className="font-medium text-gray-900 dark:text-white">
                    {customer.name}
                  </TableCell>
                  <TableCell>
                    {customer.terminated_at
                      ? new Date(customer.terminated_at).toLocaleDateString('da-DK')
                      : '-'}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {customer.termination_reason || '-'}
                  </TableCell>
                  <TableCell>
                    {customer.termination_declared_user?.full_name || '-'}
                  </TableCell>
                  <TableCell>
                    {customer.termination_document_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<FileText className="w-4 h-4" />}
                        onClick={() => window.open(customer.termination_document_url, '_blank')}
                      >
                        Se
                      </Button>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Termination Modal */}
      <Modal
        isOpen={showTerminationModal}
        onClose={() => setShowTerminationModal(false)}
        title="Opsig Kunde"
        size="lg"
      >
        <div className="space-y-6">
          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Årsag til opsigelse *
            </label>
            <TextArea
              value={terminationReason}
              onChange={(e) => setTerminationReason(e.target.value)}
              placeholder="Beskriv årsagen til opsigelsen..."
              rows={3}
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Upload dokumentation *
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Upload dokumentation for opsigelsen (f.eks. mail-korrespondance, opsigelsesbesked, etc.)
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => setTerminationFile(e.target.files?.[0] || null)}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.msg,.eml"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-dark-border rounded-lg p-6 text-center cursor-pointer hover:border-primary-500 transition-colors"
            >
              {terminationFile ? (
                <div className="flex items-center justify-center gap-2 text-success">
                  <FileText className="w-5 h-5" />
                  <span>{terminationFile.name}</span>
                </div>
              ) : (
                <div className="text-gray-500 dark:text-gray-400">
                  <Upload className="w-8 h-8 mx-auto mb-2" />
                  <p>Klik for at uploade fil</p>
                  <p className="text-xs mt-1">PDF, Word, billeder eller email-filer</p>
                </div>
              )}
            </div>
          </div>

          {/* Declaration */}
          <div className="bg-gray-50 dark:bg-dark-hover rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={declarationAccepted}
                onChange={(e) => setDeclarationAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Jeg erklærer hermed på <strong>tro og love</strong> at kunden er opsagt, og at den vedhæftede dokumentation er ægte og korrekt.
                Jeg er bevidst om at falsk erklæring kan medføre kontraktmæssige konsekvenser.
              </span>
            </label>
          </div>
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowTerminationModal(false)}>
            Annuller
          </Button>
          <Button
            variant="danger"
            onClick={handleTermination}
            disabled={!terminationReason || !terminationFile || !declarationAccepted || submitting}
          >
            {submitting ? 'Opsiger...' : 'Bekræft Opsigelse'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

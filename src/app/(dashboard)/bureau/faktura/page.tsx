'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
} from '@/components/ui'
import { Upload, Download, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Customer, Invoice } from '@/types/database'

export default function BureauFakturaPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bureauId, setBureauId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: userData } = await supabase
      .from('users')
      .select('bureau_id')
      .eq('id', user?.id)
      .single()

    setBureauId(userData?.bureau_id)

    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        invoices:invoices(*)
      `)
      .eq('bureau_id', userData?.bureau_id)
      .eq('status', 'aktiv')
      .order('name')

    if (!error) {
      setCustomers(data || [])
    }
    setLoading(false)
  }

  function openInvoiceModal(customer: Customer) {
    setSelectedCustomer(customer)
    setInvoiceAmount('')
    setInvoiceFile(null)
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCustomer || !invoiceFile || !invoiceAmount) return

    setSubmitting(true)

    try {
      // Upload fil
      const fileExt = invoiceFile.name.split('.').pop()
      const fileName = `${Date.now()}-${invoiceFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, invoiceFile)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('invoices')
        .getPublicUrl(fileName)

      // Opret faktura
      const now = new Date()
      const { error: dbError } = await supabase.from('invoices').insert({
        bureau_id: bureauId,
        customer_id: selectedCustomer.id,
        amount: parseFloat(invoiceAmount),
        file_url: urlData.publicUrl,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      })

      if (dbError) throw dbError

      toast.success('Faktura indberettet!')
      setShowModal(false)
      fetchData()
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke indberette faktura')
    } finally {
      setSubmitting(false)
    }
  }

  function getCurrentMonthInvoice(customer: any) {
    const now = new Date()
    return customer.invoices?.find(
      (inv: Invoice) => Number(inv.month) === now.getMonth() + 1 && Number(inv.year) === now.getFullYear()
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  const now = new Date()
  const monthNames = [
    'Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'December'
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faktura</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Indberet fakturaer for {monthNames[now.getMonth()]} {now.getFullYear()}
        </p>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <Receipt className="w-5 h-5" />
            <p>
              Upload fakturabeløb og faktura fil for hver kunde. Dette skal gøres hver 1. i måneden.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kunde</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Denne Md. Faktura</TableHead>
              <TableHead>Handling</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableEmpty message="Ingen aktive kunder" />
            ) : (
              customers.map((customer) => {
                const currentInvoice = getCurrentMonthInvoice(customer)
                return (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium text-gray-900 dark:text-white">
                      {customer.name}
                    </TableCell>
                    <TableCell>{customer.email || '-'}</TableCell>
                    <TableCell>
                      {currentInvoice ? (
                        <span className="text-success-light font-medium">
                          {currentInvoice.amount.toLocaleString('da-DK')} kr
                        </span>
                      ) : (
                        <span className="text-warning">Ikke indberettet</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {currentInvoice ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Download className="w-4 h-4" />}
                          onClick={() => window.open(currentInvoice.file_url, '_blank')}
                        >
                          Download
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          icon={<Upload className="w-4 h-4" />}
                          onClick={() => openInvoiceModal(customer)}
                        >
                          Indberet Faktura
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Invoice Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`Indberet Faktura - ${selectedCustomer?.name}`}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Faktura Beløb (kr)"
            type="number"
            step="0.01"
            min="0"
            value={invoiceAmount}
            onChange={(e) => setInvoiceAmount(e.target.value)}
            required
            placeholder="10000.00"
          />

          <div>
            <label className="label">Upload Faktura</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
              className="input py-2"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              PDF, PNG eller JPG (max 10MB)
            </p>
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
              Indberet Faktura
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  )
}

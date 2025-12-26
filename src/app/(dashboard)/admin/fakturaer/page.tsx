'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  Button,
  Select,
} from '@/components/ui'
import { Download, Building2, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Bureau, Invoice, Customer } from '@/types/database'

interface BureauWithInvoices extends Bureau {
  customers: (Customer & { invoices: Invoice[] })[]
  totalInvoiced: number
  toInvoice: number // Hvad Øresund skal fakturere bureauet
}

const monthNames = [
  'Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'December'
]

export default function FakturaerPage() {
  const [bureausWithInvoices, setBureausWithInvoices] = useState<BureauWithInvoices[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [selectedMonth, selectedYear])

  async function fetchData() {
    setLoading(true)

    // Hent alle bureauer
    const { data: bureaus } = await supabase
      .from('bureaus')
      .select('*')
      .order('name')

    if (!bureaus) {
      setLoading(false)
      return
    }

    // For hver bureau, hent kunder med fakturaer for den valgte måned
    const bureausData = await Promise.all(
      bureaus.map(async (bureau) => {
        const { data: customers } = await supabase
          .from('customers')
          .select(`
            *,
            invoices:invoices(*)
          `)
          .eq('bureau_id', bureau.id)

        // Filtrer fakturaer for den valgte måned/år
        const customersWithFilteredInvoices = (customers || []).map((customer: any) => ({
          ...customer,
          invoices: (customer.invoices || []).filter(
            (inv: Invoice) => inv.month === String(selectedMonth) && inv.year === selectedYear
          )
        }))

        // Behold kun kunder med fakturaer i den valgte periode
        const customersWithInvoices = customersWithFilteredInvoices.filter(
          (c: any) => c.invoices.length > 0
        )

        const totalInvoiced = customersWithInvoices.reduce(
          (sum: number, c: any) =>
            sum + (c.invoices?.reduce((s: number, i: Invoice) => s + i.amount, 0) || 0),
          0
        )

        // Beregn hvad Øresund skal fakturere bureauet (total × kommission%)
        const toInvoice = Math.round(totalInvoiced * (bureau.commission_percent / 100))

        return {
          ...bureau,
          customers: customersWithInvoices,
          totalInvoiced,
          toInvoice,
        }
      })
    )

    // Filtrer bureauer med fakturaer i den valgte periode
    setBureausWithInvoices(bureausData.filter((b) => b.customers.length > 0))
    setLoading(false)
  }

  function goToPreviousMonth() {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear(selectedYear - 1)
    } else {
      setSelectedMonth(selectedMonth - 1)
    }
  }

  function goToNextMonth() {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear(selectedYear + 1)
    } else {
      setSelectedMonth(selectedMonth + 1)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fakturaer</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Oversigt over bureauers fakturaer</p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-1">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="px-4 py-2 min-w-[160px] text-center">
            <span className="font-semibold text-gray-900 dark:text-white">
              {monthNames[selectedMonth - 1]} {selectedYear}
            </span>
          </div>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {bureausWithInvoices.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-gray-400">
            Ingen fakturaer for {monthNames[selectedMonth - 1]} {selectedYear}
          </div>
        </Card>
      ) : (
        bureausWithInvoices.map((bureau) => (
          <Card key={bureau.id}>
            {/* Bureau Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
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
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{bureau.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Kommission: {bureau.commission_percent}%
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Til Fakturering</p>
                <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
                  {bureau.toInvoice.toLocaleString('da-DK')} kr
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  ({bureau.totalInvoiced.toLocaleString('da-DK')} kr × {bureau.commission_percent}%)
                </p>
              </div>
            </div>

            {/* Customers Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Måned</TableHead>
                  <TableHead>Beløb</TableHead>
                  <TableHead>Faktura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bureau.customers.map((customer: any) =>
                  customer.invoices?.length > 0 ? (
                    customer.invoices.map((invoice: Invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium text-gray-900 dark:text-white">
                          {customer.name}
                        </TableCell>
                        <TableCell>
                          {invoice.month}/{invoice.year}
                        </TableCell>
                        <TableCell>
                          {invoice.amount.toLocaleString('da-DK')} kr
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Download className="w-4 h-4" />}
                            onClick={() => window.open(invoice.file_url, '_blank')}
                          >
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium text-gray-900 dark:text-white">
                        {customer.name}
                      </TableCell>
                      <TableCell colSpan={3} className="text-gray-500">
                        Ingen fakturaer endnu
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </Card>
        ))
      )}
    </div>
  )
}

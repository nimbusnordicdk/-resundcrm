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
import { Download, Building2, ChevronLeft, ChevronRight, ListFilter } from 'lucide-react'
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
  const [selectedMonth, setSelectedMonth] = useState<number | null>(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [totalInvoiceCount, setTotalInvoiceCount] = useState(0)
  const [showAll, setShowAll] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [selectedMonth, selectedYear, showAll])

  async function fetchData() {
    setLoading(true)

    // Hent total antal fakturaer for at vide om der er data
    const { count: invoiceCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })

    setTotalInvoiceCount(invoiceCount || 0)

    // Hent alle bureauer
    const { data: bureaus } = await supabase
      .from('bureaus')
      .select('*')
      .order('name')

    if (!bureaus) {
      setLoading(false)
      return
    }

    // For hver bureau, hent kunder med fakturaer
    const bureausData = await Promise.all(
      bureaus.map(async (bureau) => {
        const { data: customers } = await supabase
          .from('customers')
          .select(`
            *,
            invoices:invoices(*)
          `)
          .eq('bureau_id', bureau.id)

        // Filtrer fakturaer for den valgte måned/år (eller vis alle)
        const customersWithFilteredInvoices = (customers || []).map((customer: any) => ({
          ...customer,
          invoices: showAll
            ? (customer.invoices || [])
            : (customer.invoices || []).filter((inv: Invoice) => {
                const invMonth = parseInt(String(inv.month), 10)
                const invYear = parseInt(String(inv.year), 10)
                return invMonth === selectedMonth && invYear === selectedYear
              })
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
    if (showAll) return
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear(selectedYear - 1)
    } else {
      setSelectedMonth((selectedMonth || 1) - 1)
    }
  }

  function goToNextMonth() {
    if (showAll) return
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear(selectedYear + 1)
    } else {
      setSelectedMonth((selectedMonth || 12) + 1)
    }
  }

  function toggleShowAll() {
    setShowAll(!showAll)
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
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Oversigt over bureauers fakturaer
            {totalInvoiceCount > 0 && (
              <span className="ml-2 text-xs">({totalInvoiceCount} fakturaer totalt i databasen)</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Vis Alle Toggle */}
          <button
            onClick={toggleShowAll}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showAll
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            {showAll ? 'Vis alle' : 'Vis alle'}
          </button>

          {/* Month Selector */}
          <div className={`flex items-center gap-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-1 ${showAll ? 'opacity-50' : ''}`}>
            <button
              onClick={goToPreviousMonth}
              disabled={showAll}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="px-4 py-2 min-w-[160px] text-center">
              <span className="font-semibold text-gray-900 dark:text-white">
                {showAll ? 'Alle perioder' : `${monthNames[(selectedMonth || 1) - 1]} ${selectedYear}`}
              </span>
            </div>
            <button
              onClick={goToNextMonth}
              disabled={showAll}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {bureausWithInvoices.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-gray-400">
            {showAll
              ? 'Ingen fakturaer fundet i databasen'
              : `Ingen fakturaer for ${monthNames[(selectedMonth || 1) - 1]} ${selectedYear}`
            }
            {totalInvoiceCount === 0 && (
              <p className="mt-2 text-sm">
                Der er ingen fakturaer oprettet endnu. Fakturaer oprettes automatisk når kunder faktureres.
              </p>
            )}
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
                  <TableHead>Kommission ({bureau.commission_percent}%)</TableHead>
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
                        <TableCell className="font-semibold text-primary-600 dark:text-primary-400">
                          {Math.round(invoice.amount * (bureau.commission_percent / 100)).toLocaleString('da-DK')} kr
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
                      <TableCell colSpan={4} className="text-gray-500">
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

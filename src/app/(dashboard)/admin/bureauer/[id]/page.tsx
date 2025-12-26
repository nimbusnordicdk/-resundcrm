'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  StatCard,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  CustomerStatusBadge,
} from '@/components/ui'
import {
  ArrowLeft,
  Building2,
  Users,
  DollarSign,
  UserX,
  ExternalLink,
  Phone,
  Mail,
  FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Bureau, Customer } from '@/types/database'

export default function BureauDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [bureau, setBureau] = useState<Bureau | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [stats, setStats] = useState({
    activeCustomers: 0,
    churnedCustomers: 0,
    totalInvoiced: 0,
  })
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    fetchBureauData()
  }, [params.id])

  async function fetchBureauData() {
    // Hent bureau
    const { data: bureauData, error: bureauError } = await supabase
      .from('bureaus')
      .select('*')
      .eq('id', params.id)
      .single()

    if (bureauError) {
      toast.error('Kunne ikke hente bureau')
      router.push('/admin/bureauer')
      return
    }

    setBureau(bureauData)

    // Hent kunder
    const { data: customersData } = await supabase
      .from('customers')
      .select(`
        *,
        saelger:users!customers_saelger_id_fkey(id, full_name)
      `)
      .eq('bureau_id', params.id)
      .order('created_at', { ascending: false })

    setCustomers(customersData || [])

    // Beregn statistik
    const activeCount = customersData?.filter((c) => c.status === 'aktiv').length || 0
    const churnedCount = customersData?.filter((c) => c.status === 'opsagt').length || 0

    // Hent fakturaer
    const { data: invoices } = await supabase
      .from('invoices')
      .select('amount')
      .eq('bureau_id', params.id)

    const totalInvoiced = invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0

    setStats({
      activeCustomers: activeCount,
      churnedCustomers: churnedCount,
      totalInvoiced,
    })

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!bureau) return null

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        icon={<ArrowLeft className="w-4 h-4" />}
        onClick={() => router.push('/admin/bureauer')}
      >
        Tilbage til bureauer
      </Button>

      {/* Bureau Header */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {bureau.logo_url ? (
              <img
                src={bureau.logo_url}
                alt={bureau.name}
                className="w-24 h-24 rounded-xl object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-gray-100 dark:bg-dark-hover flex items-center justify-center">
                <Building2 className="w-12 h-12 text-gray-500" />
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{bureau.name}</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">CVR: {bureau.cvr_nr}</p>

              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Users className="w-4 h-4 text-gray-500" />
                  {bureau.contact_person}
                </div>
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Phone className="w-4 h-4 text-gray-500" />
                  {bureau.phone}
                </div>
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Mail className="w-4 h-4 text-gray-500" />
                  {bureau.email}
                </div>
                {bureau.website && (
                  <a
                    href={bureau.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Hjemmeside
                  </a>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">Kommission</p>
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {bureau.commission_percent}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Aktive Kunder"
          value={stats.activeCustomers}
          icon={Users}
          iconColor="bg-success"
        />
        <StatCard
          title="Opsagte Kunder"
          value={stats.churnedCustomers}
          icon={UserX}
          iconColor="bg-danger"
        />
        <StatCard
          title="Total Faktureret"
          value={`${stats.totalInvoiced.toLocaleString('da-DK')} kr`}
          icon={DollarSign}
          iconColor="bg-primary-600"
        />
      </div>

      {/* Customers List */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kunder</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kunde</TableHead>
              <TableHead>Sælger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Oprettet</TableHead>
              <TableHead>Opsigelse</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableEmpty message="Ingen kunder endnu" />
            ) : (
              customers.map((customer: any) => (
                <TableRow
                  key={customer.id}
                  onClick={() => router.push(`/admin/kunder/${customer.id}`)}
                  className={`cursor-pointer ${customer.status === 'opsagt' ? 'opacity-60' : ''}`}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                      {customer.email && (
                        <p className="text-sm text-gray-500">{customer.email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{customer.saelger?.full_name || '-'}</TableCell>
                  <TableCell>
                    <CustomerStatusBadge status={customer.status} />
                  </TableCell>
                  <TableCell>
                    {new Date(customer.created_at).toLocaleDateString('da-DK')}
                  </TableCell>
                  <TableCell>
                    {customer.status === 'opsagt' && customer.terminated_at ? (
                      <div className="text-sm">
                        <p className="text-gray-500 dark:text-gray-400">
                          {new Date(customer.terminated_at).toLocaleDateString('da-DK')}
                        </p>
                        {customer.termination_document_url && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(customer.termination_document_url, '_blank')
                            }}
                            className="flex items-center gap-1 text-primary-600 hover:text-primary-500 mt-1"
                          >
                            <FileText className="w-3 h-3" />
                            <span className="text-xs">Dokumentation</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

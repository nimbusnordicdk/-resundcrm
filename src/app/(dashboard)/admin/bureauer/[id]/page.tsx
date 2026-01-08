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
  LeadStatusBadge,
  Modal,
  ModalFooter,
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
  Search,
  LayoutGrid,
  List,
  Target,
  Calendar,
  ArrowUpDown,
  Camera,
  Upload,
  Key,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Bureau, Customer, Lead } from '@/types/database'

// Status order from new lead to closed/lost
const statusOrder = [
  'nyt_lead',
  'kvalifikationskald_booket',
  'discoverykald_booket',
  'salgskald_booket',
  'onboarding_booket',
  'kontrakt_sendt',
  'kontrakt_underskrevet',
  'lead_tabt',
]

export default function BureauDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [bureau, setBureau] = useState<Bureau | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState({
    activeCustomers: 0,
    churnedCustomers: 0,
    totalInvoiced: 0,
    totalLeads: 0,
  })
  const [loading, setLoading] = useState(true)
  const [leadsViewMode, setLeadsViewMode] = useState<'list' | 'grid'>('list')
  const [leadsSearchTerm, setLeadsSearchTerm] = useState('')
  const [leadsSortByStatus, setLeadsSortByStatus] = useState(false)
  const [showLogoModal, setShowLogoModal] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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

    // Hent kampagner for dette bureau
    const { data: campaignsData } = await supabase
      .from('campaigns')
      .select('id')
      .eq('bureau_id', params.id)

    // Hent leads fra disse kampagner
    if (campaignsData && campaignsData.length > 0) {
      const campaignIds = campaignsData.map(c => c.id)
      const { data: leadsData } = await supabase
        .from('leads')
        .select(`
          *,
          campaign:campaigns(id, name),
          assigned_saelger:users!leads_assigned_saelger_id_fkey(id, full_name)
        `)
        .in('campaign_id', campaignIds)
        .order('created_at', { ascending: false })

      setLeads(leadsData || [])
    }

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
      totalLeads: leads.length,
    })

    setLoading(false)
  }

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLogoFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function handleLogoUpload() {
    if (!logoFile || !bureau) return

    setUploadingLogo(true)

    try {
      const fileExt = logoFile.name.split('.').pop()
      const fileName = `${bureau.id}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, logoFile, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('bureaus')
        .update({ logo_url: urlData.publicUrl })
        .eq('id', bureau.id)

      if (updateError) throw updateError

      setBureau({ ...bureau, logo_url: urlData.publicUrl })
      toast.success('Logo opdateret!')
      setShowLogoModal(false)
      setLogoFile(null)
      setLogoPreview(null)
    } catch (error: any) {
      console.error('Logo upload error:', error)
      toast.error(error.message || 'Kunne ikke uploade logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  // Filter leads baseret på søgning
  const filteredLeads = leads
    .filter(
      (l) =>
        l.company_name?.toLowerCase().includes(leadsSearchTerm.toLowerCase()) ||
        l.contact_person?.toLowerCase().includes(leadsSearchTerm.toLowerCase()) ||
        l.phone?.includes(leadsSearchTerm) ||
        l.email?.toLowerCase().includes(leadsSearchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (!leadsSortByStatus) return 0
      const aIndex = statusOrder.indexOf(a.status) === -1 ? 999 : statusOrder.indexOf(a.status)
      const bIndex = statusOrder.indexOf(b.status) === -1 ? 999 : statusOrder.indexOf(b.status)
      return aIndex - bIndex
    })

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
            <button
              onClick={() => setShowLogoModal(true)}
              className="relative group w-24 h-24 rounded-xl overflow-hidden cursor-pointer"
              title="Klik for at ændre logo"
            >
              {bureau.logo_url ? (
                <img
                  src={bureau.logo_url}
                  alt={bureau.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-100 dark:bg-dark-hover flex items-center justify-center">
                  <Building2 className="w-12 h-12 text-gray-500" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </button>

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

              {/* Password display for admin */}
              {bureau.temp_password && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Midlertidig adgangskode</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 bg-white dark:bg-dark-card rounded text-sm font-mono text-gray-900 dark:text-white">
                      {showPassword ? bureau.temp_password : '••••••••••••'}
                    </code>
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                      title={showPassword ? 'Skjul' : 'Vis'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(bureau.temp_password!)
                        toast.success('Adgangskode kopieret')
                      }}
                      className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                      title="Kopier"
                    >
                      <Copy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </button>
                  </div>
                </div>
              )}
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          title="Total Leads"
          value={leads.length}
          icon={Target}
          iconColor="bg-info"
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

      {/* Leads Section */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-info" />
              Leads ({leads.length})
            </h2>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Søg leads..."
                  value={leadsSearchTerm}
                  onChange={(e) => setLeadsSearchTerm(e.target.value)}
                  className="input pl-10 w-64"
                />
              </div>

              {/* View Toggle */}
              <div className="flex bg-gray-100 dark:bg-dark-hover rounded-lg p-1">
                <button
                  onClick={() => setLeadsViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    leadsViewMode === 'list'
                      ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title="Liste visning"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setLeadsViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    leadsViewMode === 'grid'
                      ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title="Grid visning"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* List View */}
        {leadsViewMode === 'list' && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Virksomhed</TableHead>
                <TableHead>Kontaktperson</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Kampagne</TableHead>
                <TableHead>Sælger</TableHead>
                <TableHead>
                  <button
                    onClick={() => setLeadsSortByStatus(!leadsSortByStatus)}
                    className={`flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors ${
                      leadsSortByStatus ? 'text-primary-600 dark:text-primary-400' : ''
                    }`}
                  >
                    Status
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead>Oprettet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.length === 0 ? (
                <TableEmpty message="Ingen leads fundet" />
              ) : (
                filteredLeads.map((lead: any) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium text-gray-900 dark:text-white">
                      {lead.company_name || '-'}
                    </TableCell>
                    <TableCell>{lead.contact_person || '-'}</TableCell>
                    <TableCell>
                      {lead.phone ? (
                        <a
                          href={`/saelger/ring-op?phone=${encodeURIComponent(lead.phone)}&lead_id=${lead.id}`}
                          className="flex items-center gap-1 text-primary-600 hover:text-primary-500"
                        >
                          <Phone className="w-3 h-3" />
                          {lead.phone}
                        </a>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{lead.campaign?.name || '-'}</TableCell>
                    <TableCell>{lead.assigned_saelger?.full_name || '-'}</TableCell>
                    <TableCell>
                      <LeadStatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell>
                      {new Date(lead.created_at).toLocaleDateString('da-DK')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {/* Grid View */}
        {leadsViewMode === 'grid' && (
          <div className="p-6">
            {filteredLeads.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                Ingen leads fundet
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLeads.map((lead: any) => (
                  <div
                    key={lead.id}
                    className="p-4 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {lead.company_name || 'Ukendt virksomhed'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {lead.contact_person || 'Ingen kontaktperson'}
                        </p>
                      </div>
                      <LeadStatusBadge status={lead.status} />
                    </div>

                    <div className="space-y-2 text-sm">
                      {lead.phone && (
                        <a
                          href={`/saelger/ring-op?phone=${encodeURIComponent(lead.phone)}&lead_id=${lead.id}`}
                          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          <Phone className="w-4 h-4" />
                          {lead.phone}
                        </a>
                      )}
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          <Mail className="w-4 h-4" />
                          {lead.email}
                        </a>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-border">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {lead.campaign?.name || 'Ingen kampagne'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(lead.created_at).toLocaleDateString('da-DK')}
                        </span>
                      </div>
                      {lead.assigned_saelger && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Sælger: {lead.assigned_saelger.full_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Logo Upload Modal */}
      <Modal
        isOpen={showLogoModal}
        onClose={() => {
          setShowLogoModal(false)
          setLogoFile(null)
          setLogoPreview(null)
        }}
        title="Upload Bureau Logo"
      >
        <div className="space-y-4">
          {/* Current/Preview */}
          <div className="flex justify-center">
            <div className="relative w-32 h-32 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-dark-border">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : bureau?.logo_url ? (
                <img
                  src={bureau.logo_url}
                  alt={bureau.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-dark-hover">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-xs text-gray-500">Intet logo</span>
                </div>
              )}
            </div>
          </div>

          {/* File Input */}
          <div>
            <label className="label">Vælg billede</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoFileChange}
              className="input py-2 w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Understøttede formater: JPG, PNG, GIF (max 5MB)
            </p>
          </div>
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setShowLogoModal(false)
              setLogoFile(null)
              setLogoPreview(null)
            }}
          >
            Annuller
          </Button>
          <Button
            onClick={handleLogoUpload}
            loading={uploadingLogo}
            disabled={!logoFile}
          >
            Upload Logo
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

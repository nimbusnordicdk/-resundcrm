'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
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
import {
  Plus,
  Target,
  Search,
  Upload,
  Download,
  Users,
  Phone,
  MoreVertical,
  Power,
  PowerOff,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Papa from 'papaparse'
import type { Campaign } from '@/types/database'

export default function KampagnerPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    name: '',
  })
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchCampaigns()
  }, [])

  // Luk dropdown når man klikker udenfor
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  async function fetchCampaigns() {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        leads:leads(count),
        customers:customers(count)
      `)
      .eq('type', 'kold')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Kunne ikke hente kampagner')
    } else {
      // Hent stats for hver kampagne
      const campaignsWithStats = await Promise.all(
        (data || []).map(async (campaign) => {
          const { count: leadsCount } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)

          const { count: customersCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)

          const { count: callsCount } = await supabase
            .from('call_logs')
            .select('*', { count: 'exact', head: true })
            .in('lead_id', (
              await supabase.from('leads').select('id').eq('campaign_id', campaign.id)
            ).data?.map((l) => l.id) || [])

          return {
            ...campaign,
            leadsCount: leadsCount || 0,
            customersCount: customersCount || 0,
            callsCount: callsCount || 0,
          }
        })
      )

      setCampaigns(campaignsWithStats)
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Opret kampagne
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          name: formData.name,
          type: 'kold',
          created_by: user?.id,
          is_active: true,
        })
        .select()
        .single()

      if (campaignError) throw campaignError

      // Parse og upload leads fra CSV
      if (csvFile) {
        const text = await csvFile.text()
        Papa.parse(text, {
          header: true,
          complete: async (results) => {
            const leads = results.data
              .filter((row: any) => row.name || row.telefon || row.phone)
              .map((row: any) => ({
                campaign_id: campaign.id,
                name: row.name || row.navn || '',
                phone: row.phone || row.telefon || row['telefon nr'] || '',
                email: row.email || row.mail || '',
                company: row.company || row.virksomhed || '',
                notes: row.notes || row.noter || '',
                note1: row.note1 || '',
                note2: row.note2 || '',
                note3: row.note3 || '',
                note4: row.note4 || '',
                note5: row.note5 || '',
                status: 'nyt_lead',
              }))

            if (leads.length > 0) {
              const { error: leadsError } = await supabase
                .from('leads')
                .insert(leads)

              if (leadsError) {
                console.error('Leads error:', leadsError)
                toast.error('Nogle leads kunne ikke importeres')
              } else {
                toast.success(`${leads.length} leads importeret!`)
              }
            }
          },
        })
      }

      toast.success('Kampagne oprettet!')
      setShowModal(false)
      setFormData({ name: '' })
      setCsvFile(null)
      fetchCampaigns()
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke oprette kampagne')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleCampaignStatus(campaign: any, e: React.MouseEvent) {
    e.stopPropagation()
    setActiveDropdown(null)

    const newStatus = !campaign.is_active
    const { error } = await supabase
      .from('campaigns')
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('id', campaign.id)

    if (error) {
      toast.error('Kunne ikke opdatere kampagne')
    } else {
      toast.success(newStatus ? 'Kampagne aktiveret' : 'Kampagne deaktiveret')
      fetchCampaigns()
    }
  }

  async function handleDeleteCampaign() {
    if (!campaignToDelete) return

    setSubmitting(true)
    try {
      // Slet først alle leads tilknyttet kampagnen
      const { error: leadsError } = await supabase
        .from('leads')
        .delete()
        .eq('campaign_id', campaignToDelete.id)

      if (leadsError) throw leadsError

      // Slet derefter kampagnen
      const { error: campaignError } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignToDelete.id)

      if (campaignError) throw campaignError

      toast.success('Kampagne slettet')
      setShowDeleteModal(false)
      setCampaignToDelete(null)
      fetchCampaigns()
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke slette kampagne')
    } finally {
      setSubmitting(false)
    }
  }

  function openDeleteModal(campaign: any, e: React.MouseEvent) {
    e.stopPropagation()
    setActiveDropdown(null)
    setCampaignToDelete(campaign)
    setShowDeleteModal(true)
  }

  function downloadTemplate() {
    const csv = 'name,phone,email,company,notes,note1,note2,note3,note4,note5\nJohn Doe,+4512345678,john@example.com,Company A,Bemærkning,,,,,\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads_skabelon.csv'
    a.click()
  }

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = showInactive ? true : c.is_active !== false
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kampagner Kold</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Administrer kolde kampagner</p>
        </div>
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowModal(true)}
        >
          Opret Kampagne
        </Button>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Søg efter kampagne..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Vis deaktiverede</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kampagne</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Kunder Lukket</TableHead>
              <TableHead>Opkald</TableHead>
              <TableHead>Oprettet</TableHead>
              <TableHead className="w-12"></TableHead>
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
            ) : filteredCampaigns.length === 0 ? (
              <TableEmpty message="Ingen kampagner fundet" />
            ) : (
              filteredCampaigns.map((campaign) => (
                <TableRow
                  key={campaign.id}
                  onClick={() => router.push(`/admin/kampagner/${campaign.id}`)}
                  className={`cursor-pointer ${campaign.is_active === false ? 'opacity-60' : ''}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        campaign.is_active === false
                          ? 'bg-gray-200 dark:bg-gray-700'
                          : 'bg-primary-100 dark:bg-primary-600/20'
                      }`}>
                        <Target className={`w-5 h-5 ${
                          campaign.is_active === false
                            ? 'text-gray-500'
                            : 'text-primary-600 dark:text-primary-400'
                        }`} />
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{campaign.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {campaign.is_active === false ? (
                      <span className="badge-danger">Deaktiveret</span>
                    ) : (
                      <span className="badge-success">Aktiv</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      {campaign.leadsCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="badge-success">{campaign.customersCount}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      {campaign.callsCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(campaign.created_at).toLocaleDateString('da-DK')}
                  </TableCell>
                  <TableCell>
                    <div className="relative" data-dropdown>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveDropdown(activeDropdown === campaign.id ? null : campaign.id)
                        }}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>
                      {activeDropdown === campaign.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border shadow-lg z-50">
                          <button
                            onClick={(e) => toggleCampaignStatus(campaign, e)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors rounded-t-lg"
                          >
                            {campaign.is_active === false ? (
                              <>
                                <Power className="w-4 h-4 text-green-500" />
                                Aktiver
                              </>
                            ) : (
                              <>
                                <PowerOff className="w-4 h-4 text-orange-500" />
                                Deaktiver
                              </>
                            )}
                          </button>
                          <button
                            onClick={(e) => openDeleteModal(campaign, e)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors rounded-b-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                            Slet
                          </button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Campaign Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Opret Ny Kampagne"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Kampagne Navn"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Indtast kampagne navn"
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Upload Leads (CSV)</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={downloadTemplate}
              >
                Download Skabelon
              </Button>
            </div>
            <div className="border-2 border-dashed border-gray-300 dark:border-dark-border rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-600 dark:text-gray-400">
                  {csvFile ? csvFile.name : 'Klik for at uploade CSV'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Kolonner: name, phone, email, company, notes
                </p>
              </label>
            </div>
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
              Opret Kampagne
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setCampaignToDelete(null)
        }}
        title="Slet Kampagne"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-200">
              Er du sikker på, at du vil slette kampagnen <strong>"{campaignToDelete?.name}"</strong>?
              Dette vil også slette alle {campaignToDelete?.leadsCount || 0} leads tilknyttet kampagnen.
              Denne handling kan ikke fortrydes.
            </p>
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false)
                setCampaignToDelete(null)
              }}
            >
              Annuller
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={submitting}
              onClick={handleDeleteCampaign}
            >
              Slet Kampagne
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  )
}

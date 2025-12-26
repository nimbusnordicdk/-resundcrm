'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  StatCard,
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
  LeadStatusBadge,
} from '@/components/ui'
import {
  ArrowLeft,
  Target,
  Users,
  Phone,
  Trophy,
  CheckCircle,
  Upload,
  Download,
  Plus,
  FileSpreadsheet,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Papa from 'papaparse'
import type { Campaign, Lead } from '@/types/database'

interface LeaderboardEntry {
  id: string
  name: string
  sales: number
}

export default function KampagneDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState({
    totalLeads: 0,
    customersCount: 0,
    callsCount: 0,
  })
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])

  const supabase = createClient()

  useEffect(() => {
    fetchCampaignData()
  }, [params.id])

  async function fetchCampaignData() {
    // Hent kampagne
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', params.id)
      .single()

    if (campaignError) {
      toast.error('Kunne ikke hente kampagne')
      router.push('/admin/kampagner')
      return
    }

    setCampaign(campaignData)

    // Hent leads
    const { data: leadsData } = await supabase
      .from('leads')
      .select(`
        *,
        saelger:users!leads_assigned_saelger_id_fkey(id, full_name)
      `)
      .eq('campaign_id', params.id)
      .order('created_at', { ascending: false })

    setLeads(leadsData || [])

    // Stats
    const { count: customersCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', params.id)

    const { count: callsCount } = await supabase
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .in('lead_id', (leadsData || []).map((l) => l.id))

    setStats({
      totalLeads: leadsData?.length || 0,
      customersCount: customersCount || 0,
      callsCount: callsCount || 0,
    })

    // Leaderboard - top sælgere
    const { data: customers } = await supabase
      .from('customers')
      .select(`
        saelger_id,
        saelger:users!customers_saelger_id_fkey(id, full_name)
      `)
      .eq('campaign_id', params.id)

    if (customers && customers.length > 0) {
      const salesByUser: Record<string, { name: string; count: number }> = {}
      customers.forEach((c: any) => {
        if (c.saelger) {
          if (!salesByUser[c.saelger.id]) {
            salesByUser[c.saelger.id] = { name: c.saelger.full_name, count: 0 }
          }
          salesByUser[c.saelger.id].count++
        }
      })

      const leaderboardData = Object.entries(salesByUser)
        .map(([id, data]) => ({ id, name: data.name, sales: data.count }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5)

      setLeaderboard(leaderboardData)
    }

    setLoading(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvFile(file)

    // Parse og vis preview
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      Papa.parse(text, {
        header: true,
        complete: (results) => {
          const validRows = results.data
            .filter((row: any) => row.name || row.navn || row.telefon || row.phone)
            .slice(0, 5) // Vis kun første 5 rækker som preview
          setPreviewData(validRows)
        },
      })
    }
    reader.readAsText(file)
  }

  async function handleUploadLeads() {
    if (!csvFile || !campaign) return

    setUploading(true)

    try {
      const text = await csvFile.text()
      Papa.parse(text, {
        header: true,
        complete: async (results) => {
          const leads = results.data
            .filter((row: any) => row.name || row.navn || row.telefon || row.phone)
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

          if (leads.length === 0) {
            toast.error('Ingen gyldige leads fundet i filen')
            setUploading(false)
            return
          }

          const { error } = await supabase.from('leads').insert(leads)

          if (error) {
            console.error('Upload error:', error)
            toast.error('Kunne ikke uploade leads')
          } else {
            toast.success(`${leads.length} leads tilføjet!`)
            setShowUploadModal(false)
            setCsvFile(null)
            setPreviewData([])
            fetchCampaignData()
          }

          setUploading(false)
        },
      })
    } catch (error) {
      console.error('Parse error:', error)
      toast.error('Kunne ikke læse CSV-filen')
      setUploading(false)
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!campaign) return null

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        icon={<ArrowLeft className="w-4 h-4" />}
        onClick={() => router.push('/admin/kampagner')}
      >
        Tilbage til kampagner
      </Button>

      {/* Campaign Header */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                campaign.is_active === false
                  ? 'bg-gray-200 dark:bg-gray-700'
                  : 'bg-primary-600/20'
              }`}>
                <Target className={`w-8 h-8 ${
                  campaign.is_active === false
                    ? 'text-gray-500'
                    : 'text-primary-600 dark:text-primary-400'
                }`} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{campaign.name}</h1>
                  {campaign.is_active === false ? (
                    <span className="badge-danger">Deaktiveret</span>
                  ) : (
                    <span className="badge-success">Aktiv</span>
                  )}
                </div>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Oprettet {new Date(campaign.created_at).toLocaleDateString('da-DK')}
                </p>
              </div>
            </div>
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowUploadModal(true)}
            >
              Tilføj Leads
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Antal Leads"
          value={stats.totalLeads}
          icon={Users}
          iconColor="bg-info"
        />
        <StatCard
          title="Kunder Lukket"
          value={stats.customersCount}
          icon={CheckCircle}
          iconColor="bg-success"
        />
        <StatCard
          title="Opkald"
          value={stats.callsCount}
          icon={Phone}
          iconColor="bg-primary-600"
        />
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border flex items-center gap-2">
            <Trophy className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Leaderboard</h2>
          </div>
          <CardContent>
            <div className="space-y-3">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-100 dark:bg-dark-hover"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0
                          ? 'bg-warning text-dark-bg'
                          : index === 1
                          ? 'bg-gray-400 text-dark-bg'
                          : index === 2
                          ? 'bg-orange-600 text-white'
                          : 'bg-dark-border text-gray-400'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">{entry.name}</span>
                  </div>
                  <span className="badge-success">{entry.sales} salg</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leads Table */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alle Leads</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">{leads.length} leads</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Navn</TableHead>
              <TableHead>Virksomhed</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sælger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableEmpty message="Ingen leads i denne kampagne" />
            ) : (
              leads.map((lead: any) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium text-gray-900 dark:text-white">
                    {lead.name}
                  </TableCell>
                  <TableCell>{lead.company || '-'}</TableCell>
                  <TableCell>{lead.phone}</TableCell>
                  <TableCell>{lead.email || '-'}</TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell>{lead.saelger?.full_name || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Upload Leads Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false)
          setCsvFile(null)
          setPreviewData([])
        }}
        title="Tilføj Leads fra CSV"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload en CSV-fil med nye leads til denne kampagne
            </p>
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
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload-modal"
            />
            <label htmlFor="csv-upload-modal" className="cursor-pointer">
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                {csvFile ? csvFile.name : 'Klik for at vælge CSV-fil'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Kolonner: name, phone, email, company, notes
              </p>
            </label>
          </div>

          {/* Preview */}
          {previewData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Preview (første 5 rækker)
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-dark-hover">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Navn</th>
                      <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Telefon</th>
                      <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Email</th>
                      <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Virksomhed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                    {previewData.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-gray-900 dark:text-white">{row.name || row.navn || '-'}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.phone || row.telefon || '-'}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.email || row.mail || '-'}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.company || row.virksomhed || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowUploadModal(false)
                setCsvFile(null)
                setPreviewData([])
              }}
            >
              Annuller
            </Button>
            <Button
              type="button"
              loading={uploading}
              disabled={!csvFile}
              onClick={handleUploadLeads}
            >
              Upload Leads
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  )
}

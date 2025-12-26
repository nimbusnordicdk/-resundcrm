'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
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
} from '@/components/ui'
import { Target, Users, Phone, Search } from 'lucide-react'
import type { Campaign } from '@/types/database'

export default function KoldkampagnerPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchCampaigns()
  }, [])

  async function fetchCampaigns() {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('type', 'kold')
      .order('created_at', { ascending: false })

    if (!error && data) {
      // Hent stats for hver kampagne
      const campaignsWithStats = await Promise.all(
        data.map(async (campaign) => {
          const { count: leadsCount } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)

          const { count: closedCount } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('status', 'kontrakt_underskrevet')

          return {
            ...campaign,
            leadsCount: leadsCount || 0,
            closedCount: closedCount || 0,
          }
        })
      )

      setCampaigns(campaignsWithStats)
    }
    setLoading(false)
  }

  const filteredCampaigns = campaigns.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Koldkampagner</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Dine kolde leads kampagner</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Søg efter kampagne..."
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
              <TableHead>Kampagne</TableHead>
              <TableHead>Antal Leads</TableHead>
              <TableHead>Lukket</TableHead>
              <TableHead>Oprettet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
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
                  onClick={() => router.push(`/saelger/koldkampagner/${campaign.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-600/20 flex items-center justify-center">
                        <Target className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{campaign.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      {campaign.leadsCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="badge-success">{campaign.closedCount}</span>
                  </TableCell>
                  <TableCell>
                    {new Date(campaign.created_at).toLocaleDateString('da-DK')}
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

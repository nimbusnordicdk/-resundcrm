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
import { Building2, Users, Search } from 'lucide-react'
import type { Bureau } from '@/types/database'

export default function BureaukampagnerPage() {
  const [bureaus, setBureaus] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchBureaus()
  }, [])

  async function fetchBureaus() {
    const { data: bureausData } = await supabase
      .from('bureaus')
      .select('*')
      .order('name')

    if (bureausData) {
      // Hent kampagner for hvert bureau
      const bureausWithStats = await Promise.all(
        bureausData.map(async (bureau) => {
          const { count: campaignsCount } = await supabase
            .from('campaigns')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'bureau')
            .eq('bureau_id', bureau.id)

          const { count: leadsCount } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .in('campaign_id', (
              await supabase
                .from('campaigns')
                .select('id')
                .eq('bureau_id', bureau.id)
            ).data?.map((c) => c.id) || [])

          return {
            ...bureau,
            campaignsCount: campaignsCount || 0,
            leadsCount: leadsCount || 0,
          }
        })
      )

      setBureaus(bureausWithStats)
    }
    setLoading(false)
  }

  const filteredBureaus = bureaus.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bureau Kampagner</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Leads fra bureauernes Facebook Ads</p>
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

      {/* Bureaus List */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bureau</TableHead>
              <TableHead>Kampagner</TableHead>
              <TableHead>Leads</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
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
                  onClick={() => router.push(`/saelger/bureaukampagner/${bureau.id}`)}
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
                  <TableCell>{bureau.campaignsCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      {bureau.leadsCount}
                    </div>
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

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, StatCard, Button } from '@/components/ui'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Target,
  Phone,
  Clock,
  DollarSign,
  Award,
  Calendar,
  Building2,
  Users,
  Zap,
  Trophy,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Briefcase,
  UserCheck,
  UserX,
  RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface DailyStats {
  date: string
  customers: number
  leads: number
  calls: number
  revenue: number
}

interface SaelgerStats {
  id: string
  name: string
  customers: number
  calls: number
  callMinutes: number
  conversionRate: number
  revenue: number
  revenuePerMinute: number
}

interface BureauStats {
  id: string
  name: string
  customers: number
  activeCustomers: number
  churnedCustomers: number
  revenue: number
  ltv: number
  churnRate: number
}

interface CampaignStats {
  id: string
  name: string
  type: string
  leads: number
  customers: number
  conversionRate: number
  revenue: number
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']

export default function AdminStatsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month')

  // Core metrics
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [totalLeads, setTotalLeads] = useState(0)
  const [totalCalls, setTotalCalls] = useState(0)
  const [totalCallMinutes, setTotalCallMinutes] = useState(0)
  const [activeCustomers, setActiveCustomers] = useState(0)
  const [churnedCustomers, setChurnedCustomers] = useState(0)
  const [avgLTV, setAvgLTV] = useState(0)

  // Period comparisons
  const [revenueGrowth, setRevenueGrowth] = useState(0)
  const [customerGrowth, setCustomerGrowth] = useState(0)

  // Leaderboards
  const [saelgerStats, setSaelgerStats] = useState<SaelgerStats[]>([])
  const [bureauStats, setBureauStats] = useState<BureauStats[]>([])
  const [campaignStats, setCampaignStats] = useState<CampaignStats[]>([])

  // Chart data
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number; customers: number }[]>([])

  // Config
  const revenuePerCustomer = 2500 // Gennemsnitlig månedlig indtægt per kunde
  const commissionRate = 0.20 // 20% kommission til sælger

  const supabase = createClient()

  useEffect(() => {
    fetchAllStats()
  }, [timeRange])

  async function fetchAllStats() {
    setLoading(true)
    try {
      const now = new Date()

      // Calculate date ranges
      let rangeStart: Date
      let prevRangeStart: Date
      let prevRangeEnd: Date

      if (timeRange === 'week') {
        rangeStart = new Date(now)
        rangeStart.setDate(now.getDate() - 7)
        prevRangeStart = new Date(rangeStart)
        prevRangeStart.setDate(prevRangeStart.getDate() - 7)
        prevRangeEnd = new Date(rangeStart)
      } else if (timeRange === 'month') {
        rangeStart = new Date(now.getFullYear(), now.getMonth(), 1)
        prevRangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        prevRangeEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      } else if (timeRange === 'quarter') {
        const quarter = Math.floor(now.getMonth() / 3)
        rangeStart = new Date(now.getFullYear(), quarter * 3, 1)
        prevRangeStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1)
        prevRangeEnd = new Date(now.getFullYear(), quarter * 3, 0)
      } else {
        rangeStart = new Date(now.getFullYear(), 0, 1)
        prevRangeStart = new Date(now.getFullYear() - 1, 0, 1)
        prevRangeEnd = new Date(now.getFullYear() - 1, 11, 31)
      }

      // Fetch all data in parallel
      const [
        customersResult,
        prevCustomersResult,
        allCustomersResult,
        leadsResult,
        callsResult,
        usersResult,
        bureausResult,
        campaignsResult,
      ] = await Promise.all([
        // Current period customers
        supabase
          .from('customers')
          .select('id, created_at, saelger_id, bureau_id, campaign_id, status')
          .gte('created_at', rangeStart.toISOString()),
        // Previous period customers (for growth)
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', prevRangeStart.toISOString())
          .lt('created_at', prevRangeEnd.toISOString()),
        // All customers for LTV and status
        supabase
          .from('customers')
          .select('id, created_at, saelger_id, bureau_id, status'),
        // Leads
        supabase
          .from('leads')
          .select('id, created_at, campaign_id, status')
          .gte('created_at', rangeStart.toISOString()),
        // Call logs
        supabase
          .from('call_logs')
          .select('id, created_at, duration_seconds, saelger_id')
          .gte('created_at', rangeStart.toISOString()),
        // Users (sælgere)
        supabase
          .from('users')
          .select('id, full_name, role')
          .eq('role', 'saelger'),
        // Bureaus
        supabase
          .from('bureaus')
          .select('id, name'),
        // Campaigns
        supabase
          .from('campaigns')
          .select('id, name, type'),
      ])

      const customers = customersResult.data || []
      const allCustomers = allCustomersResult.data || []
      const leads = leadsResult.data || []
      const calls = callsResult.data || []
      const users = usersResult.data || []
      const bureaus = bureausResult.data || []
      const campaigns = campaignsResult.data || []

      // Core metrics
      const periodRevenue = customers.length * revenuePerCustomer
      setTotalRevenue(periodRevenue)
      setTotalCustomers(customers.length)
      setTotalLeads(leads.length)
      setTotalCalls(calls.length)

      const callMinutes = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / 60
      setTotalCallMinutes(Math.round(callMinutes))

      // Customer status
      const active = allCustomers.filter(c => c.status === 'aktiv' || c.status === 'afventer_bekraeftelse').length
      const churned = allCustomers.filter(c => c.status === 'opsagt').length
      setActiveCustomers(active)
      setChurnedCustomers(churned)

      // LTV calculation (simplified: avg months * monthly revenue)
      const avgMonthsActive = 12 // Antaget gennemsnit
      setAvgLTV(revenuePerCustomer * avgMonthsActive)

      // Growth calculations
      const prevCount = prevCustomersResult.count || 0
      if (prevCount > 0) {
        setCustomerGrowth(Math.round(((customers.length - prevCount) / prevCount) * 100))
        setRevenueGrowth(Math.round(((customers.length - prevCount) / prevCount) * 100))
      } else {
        setCustomerGrowth(customers.length > 0 ? 100 : 0)
        setRevenueGrowth(customers.length > 0 ? 100 : 0)
      }

      // Build daily stats
      const dailyMap = new Map<string, DailyStats>()
      const daysInRange = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : timeRange === 'quarter' ? 90 : 365

      for (let i = Math.min(daysInRange, 30) - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        dailyMap.set(dateStr, { date: dateStr, customers: 0, leads: 0, calls: 0, revenue: 0 })
      }

      customers.forEach(c => {
        const dateStr = c.created_at.split('T')[0]
        const stat = dailyMap.get(dateStr)
        if (stat) {
          stat.customers++
          stat.revenue += revenuePerCustomer
        }
      })

      leads.forEach(l => {
        const dateStr = l.created_at.split('T')[0]
        const stat = dailyMap.get(dateStr)
        if (stat) stat.leads++
      })

      calls.forEach(c => {
        const dateStr = c.created_at.split('T')[0]
        const stat = dailyMap.get(dateStr)
        if (stat) stat.calls++
      })

      setDailyStats(Array.from(dailyMap.values()))

      // Build monthly revenue (last 12 months)
      const monthlyMap = new Map<string, { revenue: number; customers: number }>()
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthKey = d.toLocaleDateString('da-DK', { month: 'short', year: '2-digit' })
        monthlyMap.set(monthKey, { revenue: 0, customers: 0 })
      }

      allCustomers.forEach(c => {
        const d = new Date(c.created_at)
        const monthKey = d.toLocaleDateString('da-DK', { month: 'short', year: '2-digit' })
        const stat = monthlyMap.get(monthKey)
        if (stat) {
          stat.customers++
          stat.revenue += revenuePerCustomer
        }
      })

      setMonthlyRevenue(
        Array.from(monthlyMap.entries()).map(([month, data]) => ({
          month,
          ...data,
        }))
      )

      // Sælger leaderboard
      const saelgerMap = new Map<string, SaelgerStats>()
      users.forEach(u => {
        saelgerMap.set(u.id, {
          id: u.id,
          name: u.full_name,
          customers: 0,
          calls: 0,
          callMinutes: 0,
          conversionRate: 0,
          revenue: 0,
          revenuePerMinute: 0,
        })
      })

      customers.forEach(c => {
        if (c.saelger_id) {
          const stat = saelgerMap.get(c.saelger_id)
          if (stat) {
            stat.customers++
            stat.revenue += revenuePerCustomer * commissionRate
          }
        }
      })

      calls.forEach(c => {
        if (c.saelger_id) {
          const stat = saelgerMap.get(c.saelger_id)
          if (stat) {
            stat.calls++
            stat.callMinutes += (c.duration_seconds || 0) / 60
          }
        }
      })

      const saelgerList = Array.from(saelgerMap.values())
        .map(s => ({
          ...s,
          callMinutes: Math.round(s.callMinutes),
          conversionRate: s.calls > 0 ? Math.round((s.customers / s.calls) * 100) : 0,
          revenuePerMinute: s.callMinutes > 0 ? Math.round(s.revenue / s.callMinutes) : 0,
        }))
        .filter(s => s.customers > 0 || s.calls > 0)
        .sort((a, b) => b.revenue - a.revenue)

      setSaelgerStats(saelgerList)

      // Bureau leaderboard
      const bureauMap = new Map<string, BureauStats>()
      bureaus.forEach(b => {
        bureauMap.set(b.id, {
          id: b.id,
          name: b.name,
          customers: 0,
          activeCustomers: 0,
          churnedCustomers: 0,
          revenue: 0,
          ltv: 0,
          churnRate: 0,
        })
      })

      allCustomers.forEach(c => {
        if (c.bureau_id) {
          const stat = bureauMap.get(c.bureau_id)
          if (stat) {
            stat.customers++
            stat.revenue += revenuePerCustomer * avgMonthsActive
            if (c.status === 'aktiv' || c.status === 'afventer_bekraeftelse') {
              stat.activeCustomers++
            } else if (c.status === 'opsagt') {
              stat.churnedCustomers++
            }
          }
        }
      })

      const bureauList = Array.from(bureauMap.values())
        .map(b => ({
          ...b,
          ltv: b.customers > 0 ? Math.round(b.revenue / b.customers) : 0,
          churnRate: b.customers > 0 ? Math.round((b.churnedCustomers / b.customers) * 100) : 0,
        }))
        .filter(b => b.customers > 0)
        .sort((a, b) => b.revenue - a.revenue)

      setBureauStats(bureauList)

      // Campaign stats
      const campaignMap = new Map<string, CampaignStats>()
      campaigns.forEach(c => {
        campaignMap.set(c.id, {
          id: c.id,
          name: c.name,
          type: c.type || 'cold',
          leads: 0,
          customers: 0,
          conversionRate: 0,
          revenue: 0,
        })
      })

      leads.forEach(l => {
        if (l.campaign_id) {
          const stat = campaignMap.get(l.campaign_id)
          if (stat) stat.leads++
        }
      })

      customers.forEach(c => {
        if (c.campaign_id) {
          const stat = campaignMap.get(c.campaign_id)
          if (stat) {
            stat.customers++
            stat.revenue += revenuePerCustomer
          }
        }
      })

      const campaignList = Array.from(campaignMap.values())
        .map(c => ({
          ...c,
          conversionRate: c.leads > 0 ? Math.round((c.customers / c.leads) * 100) : 0,
        }))
        .filter(c => c.leads > 0 || c.customers > 0)
        .sort((a, b) => b.revenue - a.revenue)

      setCampaignStats(campaignList)

    } catch (error) {
      console.error('Error fetching stats:', error)
      toast.error('Kunne ikke hente statistik')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const conversionRate = useMemo(() => {
    return totalLeads > 0 ? ((totalCustomers / totalLeads) * 100).toFixed(1) : '0'
  }, [totalCustomers, totalLeads])

  const churnRate = useMemo(() => {
    const total = activeCustomers + churnedCustomers
    return total > 0 ? ((churnedCustomers / total) * 100).toFixed(1) : '0'
  }, [activeCustomers, churnedCustomers])

  const avgRevenuePerCall = useMemo(() => {
    return totalCalls > 0 ? Math.round(totalRevenue / totalCalls) : 0
  }, [totalRevenue, totalCalls])

  function handleRefresh() {
    setRefreshing(true)
    fetchAllStats()
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary-500" />
            Øresund Stats
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Komplet overblik over Øresund Partners performance
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex bg-gray-100 dark:bg-dark-hover rounded-lg p-1">
            {(['week', 'month', 'quarter', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {range === 'week' ? 'Uge' : range === 'month' ? 'Måned' : range === 'quarter' ? 'Kvartal' : 'År'}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Opdater
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
          <CardContent className="py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Total Omsætning</p>
                <p className="text-3xl font-bold mt-1">{totalRevenue.toLocaleString('da-DK')} kr</p>
                <div className={`flex items-center gap-1 mt-2 text-sm ${revenueGrowth >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                  {revenueGrowth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {Math.abs(revenueGrowth)}% vs. forrige periode
                </div>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-7 h-7" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success to-green-600 text-white">
          <CardContent className="py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Nye Kunder</p>
                <p className="text-3xl font-bold mt-1">{totalCustomers}</p>
                <div className={`flex items-center gap-1 mt-2 text-sm ${customerGrowth >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                  {customerGrowth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {Math.abs(customerGrowth)}% vs. forrige periode
                </div>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <Users className="w-7 h-7" />
              </div>
            </div>
          </CardContent>
        </Card>

        <StatCard
          title="Gennemsnitlig LTV"
          value={`${avgLTV.toLocaleString('da-DK')} kr`}
          icon={Briefcase}
          iconColor="bg-purple-500"
          description="Lifetime Value per kunde"
        />

        <StatCard
          title="Konverteringsrate"
          value={`${conversionRate}%`}
          icon={Target}
          iconColor="bg-info"
          description={`${totalLeads} leads → ${totalCustomers} kunder`}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <Phone className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalCalls}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Opkald</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 text-center">
            <Clock className="w-6 h-6 text-cyan-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{Math.floor(totalCallMinutes / 60)}t {totalCallMinutes % 60}m</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ringetid</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 text-center">
            <UserCheck className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeCustomers}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Aktive Kunder</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 text-center">
            <UserX className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{churnedCustomers}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Opsagte</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 text-center">
            <Activity className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{churnRate}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Churn Rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 text-center">
            <Zap className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgRevenuePerCall} kr</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Oms./Opkald</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              Omsætning & Kunder (12 mdr.)
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                  <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#9ca3af" fontSize={12} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                    formatter={(val: number, name: string) => [
                      name === 'revenue' ? `${val.toLocaleString('da-DK')} kr` : val,
                      name === 'revenue' ? 'Omsætning' : 'Kunder'
                    ]}
                  />
                  <Legend />
                  <Bar yAxisId="right" dataKey="customers" name="Kunder" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" name="Omsætning" stroke="#6366f1" strokeWidth={3} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Activity */}
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-500" />
              Daglig Aktivitet
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => new Date(val).toLocaleDateString('da-DK', { day: 'numeric' })}
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                    labelFormatter={(val) => new Date(val).toLocaleDateString('da-DK')}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="customers" name="Kunder" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="calls" name="Opkald" stroke="#6366f1" fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sælger Leaderboard */}
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Top Sælgere
            </h3>

            {saelgerStats.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">Ingen data endnu</p>
            ) : (
              <div className="space-y-3">
                {saelgerStats.slice(0, 5).map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-dark-hover">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                      idx === 1 ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300' :
                      idx === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                      'bg-gray-100 dark:bg-dark-border text-gray-500 dark:text-gray-400'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{s.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>{s.customers} kunder</span>
                        <span>{s.conversionRate}% konv.</span>
                        <span>{s.revenuePerMinute} kr/min</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-success">{s.revenue.toLocaleString('da-DK')} kr</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">kommission</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bureau Leaderboard */}
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary-500" />
              Top Bureauer (LTV)
            </h3>

            {bureauStats.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">Ingen data endnu</p>
            ) : (
              <div className="space-y-3">
                {bureauStats.slice(0, 5).map((b, idx) => (
                  <div key={b.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-dark-hover">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                      idx === 1 ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300' :
                      idx === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                      'bg-gray-100 dark:bg-dark-border text-gray-500 dark:text-gray-400'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{b.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>{b.customers} kunder</span>
                        <span className="text-green-500">{b.activeCustomers} aktive</span>
                        <span className={b.churnRate > 10 ? 'text-red-500' : ''}>{b.churnRate}% churn</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary-600 dark:text-primary-400">{b.ltv.toLocaleString('da-DK')} kr</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">LTV/kunde</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Campaign Performance & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign Table */}
        <Card className="lg:col-span-2">
          <CardContent>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-warning" />
              Kampagne Performance
            </h3>

            {campaignStats.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">Ingen kampagne data</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-dark-border">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Kampagne</th>
                      <th className="text-center py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Type</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Leads</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Kunder</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Konv.</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Omsætning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignStats.slice(0, 8).map((c) => (
                      <tr key={c.id} className="border-b border-gray-100 dark:border-dark-hover">
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{c.name}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            c.type === 'bureau'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          }`}>
                            {c.type === 'bureau' ? 'Bureau' : 'Kold'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{c.leads}</td>
                        <td className="py-2 px-3 text-right text-gray-900 dark:text-white">{c.customers}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={c.conversionRate >= 10 ? 'text-success font-medium' : 'text-gray-600 dark:text-gray-400'}>
                            {c.conversionRate}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-success">{c.revenue.toLocaleString('da-DK')} kr</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Distribution Pie */}
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-info" />
              Kundefordeling
            </h3>

            {bureauStats.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">Ingen data</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bureauStats.slice(0, 6)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="customers"
                      nameKey="name"
                    >
                      {bureauStats.slice(0, 6).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                      formatter={(val: number) => [`${val} kunder`, 'Antal']}
                    />
                    <Legend
                      formatter={(value) => <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-hover dark:to-dark-card">
          <CardContent className="py-5 text-center">
            <p className="text-4xl font-bold text-gray-900 dark:text-white">{saelgerStats.length}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Aktive Sælgere</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-hover dark:to-dark-card">
          <CardContent className="py-5 text-center">
            <p className="text-4xl font-bold text-gray-900 dark:text-white">{bureauStats.length}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Bureauer</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-hover dark:to-dark-card">
          <CardContent className="py-5 text-center">
            <p className="text-4xl font-bold text-gray-900 dark:text-white">{campaignStats.length}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kampagner</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-hover dark:to-dark-card">
          <CardContent className="py-5 text-center">
            <p className="text-4xl font-bold text-success">{(totalRevenue * 12).toLocaleString('da-DK')} kr</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Årlig Run Rate</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

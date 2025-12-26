'use client'

import { useState, useEffect, useMemo } from 'react'
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
  Select,
} from '@/components/ui'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  ArrowLeft,
  Users,
  DollarSign,
  Phone,
  Mail,
  Clock,
  TrendingDown,
  TrendingUp,
  Zap,
  Award,
  Building2,
  Calendar,
  BarChart3,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { User, Customer, CallLog } from '@/types/database'

interface DailyStats {
  date: string
  customers: number
  calls: number
  callMinutes: number
}

interface CampaignPerformance {
  id: string
  name: string
  type: 'cold' | 'bureau'
  customers: number
  calls: number
  callMinutes: number
  revenuePerMinute: number
  conversionRate: number
}

interface BureauPerformance {
  id: string
  name: string
  customers: number
  revenue: number
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

export default function SaelgerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [saelger, setSaelger] = useState<User | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [stats, setStats] = useState({
    customersCount: 0,
    salaryThisMonth: 0,
    salaryLastMonth: 0,
    leadsLost: 0,
  })
  const [lostPeriod, setLostPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [loading, setLoading] = useState(true)

  // Stats data (same as sælger stats)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month')
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [totalCalls, setTotalCalls] = useState(0)
  const [totalCallMinutes, setTotalCallMinutes] = useState(0)
  const [customersToday, setCustomersToday] = useState(0)
  const [customersThisWeek, setCustomersThisWeek] = useState(0)
  const [customersThisMonth, setCustomersThisMonth] = useState(0)
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [campaignPerformance, setCampaignPerformance] = useState<CampaignPerformance[]>([])
  const [bureauPerformance, setBureauPerformance] = useState<BureauPerformance[]>([])

  const commissionPerSale = 500 // DKK

  const supabase = createClient()

  useEffect(() => {
    fetchSaelgerData()
  }, [params.id])

  useEffect(() => {
    if (saelger) {
      fetchLeadsLost()
      fetchPerformanceStats()
    }
  }, [lostPeriod, saelger, timeRange])

  async function fetchSaelgerData() {
    // Hent sælger
    const { data: saelgerData, error: saelgerError } = await supabase
      .from('users')
      .select('*')
      .eq('id', params.id)
      .single()

    if (saelgerError) {
      toast.error('Kunne ikke hente sælger')
      router.push('/admin/ansatte')
      return
    }

    setSaelger(saelgerData)

    // Hent kunder lukket af sælger
    const { data: customersData } = await supabase
      .from('customers')
      .select(`
        *,
        bureau:bureaus(id, name)
      `)
      .eq('saelger_id', params.id)
      .order('created_at', { ascending: false })

    setCustomers(customersData || [])

    // Hent opkald
    const { data: callsData } = await supabase
      .from('call_logs')
      .select('*')
      .eq('saelger_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50)

    // Hent lead info separat for opkald der har lead_id
    const callsWithLeads = callsData || []
    const leadIds = callsWithLeads
      .filter(c => c.lead_id)
      .map(c => c.lead_id)

    let leadsMap = new Map()
    if (leadIds.length > 0) {
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, company_name, contact_person')
        .in('id', leadIds)

      leadsData?.forEach(lead => {
        leadsMap.set(lead.id, lead)
      })
    }

    // Tilføj lead info til opkald
    const callsWithLeadInfo = callsWithLeads.map(call => ({
      ...call,
      lead: call.lead_id ? leadsMap.get(call.lead_id) || null : null
    }))

    setCallLogs(callsWithLeadInfo)

    // Beregn løn
    const now = new Date()
    const thisMonth = now.getMonth() + 1
    const thisYear = now.getFullYear()
    const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1
    const lastMonthYear = thisMonth === 1 ? thisYear - 1 : thisYear

    // Hent fakturaer for denne og sidste måned
    const { data: invoicesThisMonth } = await supabase
      .from('invoices')
      .select('amount, customer_id')
      .eq('month', thisMonth)
      .eq('year', thisYear)
      .in('customer_id', (customersData || []).map((c) => c.id))

    const { data: invoicesLastMonth } = await supabase
      .from('invoices')
      .select('amount, customer_id')
      .eq('month', lastMonth)
      .eq('year', lastMonthYear)
      .in('customer_id', (customersData || []).map((c) => c.id))

    const totalThisMonth = invoicesThisMonth?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0
    const totalLastMonth = invoicesLastMonth?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0

    const commissionPercent = saelgerData.commission_percent || 20

    setStats({
      customersCount: customersData?.length || 0,
      salaryThisMonth: totalThisMonth * (commissionPercent / 100),
      salaryLastMonth: totalLastMonth * (commissionPercent / 100),
      leadsLost: 0,
    })

    setLoading(false)
  }

  async function fetchLeadsLost() {
    let dateFilter = new Date()

    if (lostPeriod === 'week') {
      dateFilter.setDate(dateFilter.getDate() - 7)
    } else if (lostPeriod === 'month') {
      dateFilter.setMonth(dateFilter.getMonth() - 1)
    } else {
      dateFilter.setFullYear(dateFilter.getFullYear() - 1)
    }

    const { count } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_saelger_id', params.id)
      .eq('status', 'lead_tabt')
      .gte('updated_at', dateFilter.toISOString())

    setStats((prev) => ({ ...prev, leadsLost: count || 0 }))
  }

  async function fetchPerformanceStats() {
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    let rangeStart: Date
    if (timeRange === 'week') {
      rangeStart = startOfWeek
    } else if (timeRange === 'month') {
      rangeStart = startOfMonth
    } else {
      rangeStart = new Date(now.getFullYear(), 0, 1)
    }

    const [
      customersResult,
      customersTodayResult,
      customersWeekResult,
      customersMonthResult,
      callLogsResult,
      campaignsResult,
      bureausResult,
    ] = await Promise.all([
      supabase
        .from('customers')
        .select('id, created_at, campaign_id, bureau_id')
        .eq('saelger_id', params.id)
        .gte('created_at', rangeStart.toISOString()),
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('saelger_id', params.id)
        .gte('created_at', today),
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('saelger_id', params.id)
        .gte('created_at', startOfWeek.toISOString()),
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('saelger_id', params.id)
        .gte('created_at', startOfMonth.toISOString()),
      supabase
        .from('call_logs')
        .select('id, created_at, duration_seconds, lead_id')
        .eq('saelger_id', params.id)
        .gte('created_at', rangeStart.toISOString()),
      supabase
        .from('campaigns')
        .select('id, name, type'),
      supabase
        .from('bureaus')
        .select('id, name'),
    ])

    const customersList = customersResult.data || []
    const calls = callLogsResult.data || []
    const campaigns = campaignsResult.data || []
    const bureaus = bureausResult.data || []

    setTotalCustomers(customersList.length)
    setCustomersToday(customersTodayResult.count || 0)
    setCustomersThisWeek(customersWeekResult.count || 0)
    setCustomersThisMonth(customersMonthResult.count || 0)
    setTotalCalls(calls.length)

    const totalMinutes = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / 60
    setTotalCallMinutes(Math.round(totalMinutes))

    // Daily stats
    const dailyMap = new Map<string, DailyStats>()
    const daysInRange = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365

    for (let i = daysInRange - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      dailyMap.set(dateStr, { date: dateStr, customers: 0, calls: 0, callMinutes: 0 })
    }

    customersList.forEach(c => {
      const dateStr = c.created_at.split('T')[0]
      const stat = dailyMap.get(dateStr)
      if (stat) stat.customers++
    })

    calls.forEach(c => {
      const dateStr = c.created_at.split('T')[0]
      const stat = dailyMap.get(dateStr)
      if (stat) {
        stat.calls++
        stat.callMinutes += (c.duration_seconds || 0) / 60
      }
    })

    setDailyStats(Array.from(dailyMap.values()).slice(-14))

    // Campaign performance
    const campaignStatsMap = new Map<string, CampaignPerformance>()
    campaigns.forEach(camp => {
      campaignStatsMap.set(camp.id, {
        id: camp.id,
        name: camp.name,
        type: camp.type === 'bureau' ? 'bureau' : 'cold',
        customers: 0,
        calls: 0,
        callMinutes: 0,
        revenuePerMinute: 0,
        conversionRate: 0,
      })
    })

    const { data: leads } = await supabase
      .from('leads')
      .select('id, campaign_id')

    const leadCampaignMap = new Map<string, string>()
    leads?.forEach(l => leadCampaignMap.set(l.id, l.campaign_id))

    customersList.forEach(c => {
      if (c.campaign_id) {
        const stat = campaignStatsMap.get(c.campaign_id)
        if (stat) stat.customers++
      }
    })

    calls.forEach(c => {
      if (c.lead_id) {
        const campaignId = leadCampaignMap.get(c.lead_id)
        if (campaignId) {
          const stat = campaignStatsMap.get(campaignId)
          if (stat) {
            stat.calls++
            stat.callMinutes += (c.duration_seconds || 0) / 60
          }
        }
      }
    })

    const campaignStats = Array.from(campaignStatsMap.values())
      .filter(c => c.customers > 0 || c.calls > 0)
      .map(c => ({
        ...c,
        callMinutes: Math.round(c.callMinutes),
        revenuePerMinute: c.callMinutes > 0 ? Math.round((c.customers * commissionPerSale) / c.callMinutes) : 0,
        conversionRate: c.calls > 0 ? Math.round((c.customers / c.calls) * 100) : 0,
      }))
      .sort((a, b) => b.revenuePerMinute - a.revenuePerMinute)

    setCampaignPerformance(campaignStats)

    // Bureau performance
    const bureauStatsMap = new Map<string, BureauPerformance>()
    bureaus.forEach(b => {
      bureauStatsMap.set(b.id, { id: b.id, name: b.name, customers: 0, revenue: 0 })
    })

    customersList.forEach(c => {
      if (c.bureau_id) {
        const stat = bureauStatsMap.get(c.bureau_id)
        if (stat) {
          stat.customers++
          stat.revenue += commissionPerSale
        }
      }
    })

    setBureauPerformance(
      Array.from(bureauStatsMap.values())
        .filter(b => b.customers > 0)
        .sort((a, b) => b.revenue - a.revenue)
    )
  }

  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Derived metrics
  const estimatedSalary = useMemo(() => {
    return totalCustomers * commissionPerSale
  }, [totalCustomers])

  const avgCallsPerCustomer = useMemo(() => {
    return totalCustomers > 0 ? Math.round(totalCalls / totalCustomers) : 0
  }, [totalCalls, totalCustomers])

  const conversionRate = useMemo(() => {
    return totalCalls > 0 ? ((totalCustomers / totalCalls) * 100).toFixed(1) : '0'
  }, [totalCalls, totalCustomers])

  const revenuePerMinute = useMemo(() => {
    return totalCallMinutes > 0 ? Math.round(estimatedSalary / totalCallMinutes) : 0
  }, [estimatedSalary, totalCallMinutes])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!saelger) return null

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        icon={<ArrowLeft className="w-4 h-4" />}
        onClick={() => router.push('/admin/ansatte')}
      >
        Tilbage til ansatte
      </Button>

      {/* Saelger Header */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-primary-600 flex items-center justify-center">
              <span className="text-white text-3xl font-bold">
                {saelger.full_name.charAt(0).toUpperCase()}
              </span>
            </div>

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{saelger.full_name}</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Sælger</p>

              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Mail className="w-4 h-4 text-gray-500" />
                  {saelger.email}
                </div>
                {saelger.phone && (
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Phone className="w-4 h-4 text-gray-500" />
                    {saelger.phone}
                  </div>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">Kommission</p>
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {saelger.commission_percent}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Original Stats */}
      <div className="flex items-center justify-end mb-4">
        <Select
          value={lostPeriod}
          onChange={(e) => setLostPeriod(e.target.value as any)}
          options={[
            { value: 'week', label: 'Denne uge' },
            { value: 'month', label: 'Denne md.' },
            { value: 'year', label: 'Dette år' },
          ]}
          className="w-36"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Kunder Lukket"
          value={stats.customersCount}
          icon={Users}
          iconColor="bg-success"
        />
        <StatCard
          title="Løn Denne Md."
          value={`${stats.salaryThisMonth.toLocaleString('da-DK')} kr`}
          icon={DollarSign}
          iconColor="bg-primary-600"
        />
        <StatCard
          title="Løn Sidste Md."
          value={`${stats.salaryLastMonth.toLocaleString('da-DK')} kr`}
          icon={DollarSign}
          iconColor="bg-info"
        />
        <StatCard
          title="Leads Tabt"
          value={stats.leadsLost}
          icon={TrendingDown}
          iconColor="bg-danger"
        />
      </div>

      {/* Performance Stats Section */}
      <div className="border-t border-gray-200 dark:border-dark-border pt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary-500" />
            Performance Stats
          </h2>

          <div className="flex bg-gray-100 dark:bg-dark-hover rounded-lg p-1">
            {(['week', 'month', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {range === 'week' ? 'Uge' : range === 'month' ? 'Måned' : 'År'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Estimeret Kommission"
            value={`${estimatedSalary.toLocaleString('da-DK')} kr`}
            icon={DollarSign}
            iconColor="bg-success"
            description={`${timeRange === 'week' ? 'Denne uge' : timeRange === 'month' ? 'Denne måned' : 'I år'}`}
          />
          <StatCard
            title="Kunder Lukket"
            value={totalCustomers}
            icon={Users}
            iconColor="bg-primary-600"
            description={`${customersThisWeek} denne uge`}
          />
          <StatCard
            title="Opkald Foretaget"
            value={totalCalls}
            icon={Phone}
            iconColor="bg-info"
            description={`${totalCallMinutes} minutter total`}
          />
          <StatCard
            title="Konverteringsrate"
            value={`${conversionRate}%`}
            icon={TrendingUp}
            iconColor="bg-warning"
            description={`${avgCallsPerCustomer} opkald/kunde`}
          />
        </div>

        {/* Revenue per Minute */}
        <Card className="mb-6">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-success/20 to-success/10 dark:from-success/30 dark:to-success/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-7 h-7 text-success" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Indtjening per Minut</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {revenuePerMinute} kr/min
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total ringetid</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {Math.floor(totalCallMinutes / 60)}t {totalCallMinutes % 60}m
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Daily Performance */}
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-500" />
                Daglig Performance
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyStats}>
                    <defs>
                      <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => new Date(val).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                      stroke="#9ca3af"
                      fontSize={12}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString('da-DK')}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="customers"
                      name="Kunder"
                      stroke="#6366f1"
                      fillOpacity={1}
                      fill="url(#colorCustomers)"
                    />
                    <Area
                      type="monotone"
                      dataKey="calls"
                      name="Opkald"
                      stroke="#22c55e"
                      fillOpacity={1}
                      fill="url(#colorCalls)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Call Minutes */}
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-info" />
                Ringetid per Dag (minutter)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => new Date(val).toLocaleDateString('da-DK', { day: 'numeric' })}
                      stroke="#9ca3af"
                      fontSize={12}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString('da-DK')}
                      formatter={(val: number) => [`${Math.round(val)} min`, 'Ringetid']}
                    />
                    <Bar
                      dataKey="callMinutes"
                      name="Minutter"
                      fill="#06b6d4"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaign Performance */}
        <Card className="mb-6">
          <CardContent>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-warning" />
              Kampagne Performance (Rangeret efter kr/minut)
            </h3>

            {campaignPerformance.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                Ingen kampagne data endnu
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-dark-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Rang</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Kampagne</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Type</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Kunder</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Opkald</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Minutter</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Konv. %</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">kr/min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignPerformance.map((camp, idx) => (
                      <tr key={camp.id} className="border-b border-gray-100 dark:border-dark-hover">
                        <td className="py-3 px-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                            idx === 1 ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' :
                            idx === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                            'bg-gray-50 dark:bg-dark-hover text-gray-500 dark:text-gray-500'
                          }`}>
                            {idx + 1}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{camp.name}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            camp.type === 'cold'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                          }`}>
                            {camp.type === 'cold' ? 'Kold' : 'Bureau'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900 dark:text-white">{camp.customers}</td>
                        <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">{camp.calls}</td>
                        <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">{camp.callMinutes}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={camp.conversionRate >= 10 ? 'text-success' : 'text-gray-600 dark:text-gray-400'}>
                            {camp.conversionRate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-semibold text-success">{camp.revenuePerMinute} kr</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bureau Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-500" />
                Bureau Performance
              </h3>

              {bureauPerformance.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Ingen bureau data endnu
                </p>
              ) : (
                <div className="space-y-3">
                  {bureauPerformance.slice(0, 5).map((bureau, idx) => (
                    <div key={bureau.id} className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{bureau.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{bureau.customers} kunder</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-success">{bureau.revenue.toLocaleString('da-DK')} kr</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bureau Pie Chart */}
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Fordeling per Bureau
              </h3>

              {bureauPerformance.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Ingen bureau data endnu
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={bureauPerformance}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="customers"
                        nameKey="name"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {bureauPerformance.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                        formatter={(val: number) => [`${val} kunder`, 'Antal']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Summary */}
        <Card className="mb-6">
          <CardContent className="py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{customersToday}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">I dag</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{customersThisWeek}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Denne uge</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{customersThisMonth}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Denne måned</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-success">{(customersThisMonth * commissionPerSale).toLocaleString('da-DK')} kr</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Månedens kommission</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customers Table */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kunder Lukket</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kunde</TableHead>
              <TableHead>Bureau</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Oprettet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableEmpty message="Ingen kunder endnu" />
            ) : (
              customers.map((customer: any) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium text-gray-900 dark:text-white">
                    {customer.name}
                  </TableCell>
                  <TableCell>{customer.bureau?.name || '-'}</TableCell>
                  <TableCell>
                    <span
                      className={`badge ${
                        customer.status === 'aktiv'
                          ? 'badge-success'
                          : customer.status === 'opsagt'
                          ? 'badge-danger'
                          : customer.status === 'afventer_bekraeftelse'
                          ? 'badge-warning'
                          : 'badge-secondary'
                      }`}
                    >
                      {customer.status === 'aktiv'
                        ? 'Aktiv'
                        : customer.status === 'opsagt'
                        ? 'Opsagt'
                        : customer.status === 'afventer_bekraeftelse'
                        ? 'Afventer'
                        : customer.status || 'Ukendt'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(customer.created_at).toLocaleDateString('da-DK')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Call Logs */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Opkald</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Telefon Nr.</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Varighed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tidspunkt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {callLogs.length === 0 ? (
              <TableEmpty message="Ingen opkald endnu" />
            ) : (
              callLogs.map((call: any) => (
                <TableRow key={call.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      {call.country_code} {call.phone_number}
                    </div>
                  </TableCell>
                  <TableCell>
                    {call.lead ? (
                      <span className="text-gray-900 dark:text-white">
                        {call.lead.company_name || call.lead.contact_person || 'Lead'}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 italic">Ikke Lead</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      {formatDuration(call.duration_seconds)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`badge ${
                        call.status === 'completed'
                          ? 'badge-success'
                          : call.status === 'no_answer'
                          ? 'badge-warning'
                          : 'badge-danger'
                      }`}
                    >
                      {call.status === 'completed'
                        ? 'Gennemført'
                        : call.status === 'no_answer'
                        ? 'Ikke Svaret'
                        : call.status === 'busy'
                        ? 'Optaget'
                        : 'Fejlet'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(call.created_at).toLocaleString('da-DK')}
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

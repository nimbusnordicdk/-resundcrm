'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, StatCard, Button, Input } from '@/components/ui'
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
} from 'recharts'
import {
  TrendingUp,
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
  ArrowUp,
  ArrowDown,
  BarChart3,
  Settings,
  CheckCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

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

export default function OresundStatsPage() {
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month')
  const [showGoalModal, setShowGoalModal] = useState(false)

  // Core stats
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [totalCalls, setTotalCalls] = useState(0)
  const [totalCallMinutes, setTotalCallMinutes] = useState(0)
  const [customersToday, setCustomersToday] = useState(0)
  const [customersThisWeek, setCustomersThisWeek] = useState(0)
  const [customersThisMonth, setCustomersThisMonth] = useState(0)

  // Daily goal
  const [dailyGoal, setDailyGoal] = useState(5)
  const [newGoal, setNewGoal] = useState('5')

  // Performance data
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [campaignPerformance, setCampaignPerformance] = useState<CampaignPerformance[]>([])
  const [bureauPerformance, setBureauPerformance] = useState<BureauPerformance[]>([])

  // Salary estimate (configurable per sale)
  const commissionPerSale = 500 // DKK

  const supabase = createClient()

  const [savingGoal, setSavingGoal] = useState(false)

  useEffect(() => {
    fetchAllStats()
    loadDailyGoal()
  }, [timeRange])

  async function loadDailyGoal() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('saelger_goals')
        .select('daily_customer_goal')
        .eq('saelger_id', user.id)
        .single()

      if (data) {
        setDailyGoal(data.daily_customer_goal)
        setNewGoal(data.daily_customer_goal.toString())
      }
    } catch (error) {
      // Hvis ingen mål findes, brug default (5)
      console.log('No goal found, using default')
    }
  }

  async function saveDailyGoal() {
    const goal = parseInt(newGoal)
    if (isNaN(goal) || goal < 1) {
      toast.error('Ugyldigt mål')
      return
    }

    setSavingGoal(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ikke logget ind')

      const { error } = await supabase
        .from('saelger_goals')
        .upsert({
          saelger_id: user.id,
          daily_customer_goal: goal,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'saelger_id',
        })

      if (error) throw error

      setDailyGoal(goal)
      setShowGoalModal(false)
      toast.success('Dagligt mål opdateret!')
    } catch (error) {
      console.error('Error saving goal:', error)
      toast.error('Kunne ikke gemme mål')
    } finally {
      setSavingGoal(false)
    }
  }

  async function fetchAllStats() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const now = new Date()
      const today = now.toISOString().split('T')[0]

      // Calculate date ranges
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

      // Fetch all data in parallel
      const [
        customersResult,
        customersTodayResult,
        customersWeekResult,
        customersMonthResult,
        callLogsResult,
        campaignsResult,
        bureausResult,
      ] = await Promise.all([
        // Total customers for period
        supabase
          .from('customers')
          .select('id, created_at, campaign_id, bureau_id')
          .eq('saelger_id', user.id)
          .gte('created_at', rangeStart.toISOString()),
        // Today's customers
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('saelger_id', user.id)
          .gte('created_at', today),
        // Week's customers
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('saelger_id', user.id)
          .gte('created_at', startOfWeek.toISOString()),
        // Month's customers
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('saelger_id', user.id)
          .gte('created_at', startOfMonth.toISOString()),
        // Call logs
        supabase
          .from('call_logs')
          .select('id, created_at, duration_seconds, lead_id')
          .eq('saelger_id', user.id)
          .gte('created_at', rangeStart.toISOString()),
        // Campaigns
        supabase
          .from('campaigns')
          .select('id, name, type'),
        // Bureaus
        supabase
          .from('bureaus')
          .select('id, name'),
      ])

      const customers = customersResult.data || []
      const calls = callLogsResult.data || []
      const campaigns = campaignsResult.data || []
      const bureaus = bureausResult.data || []

      setTotalCustomers(customers.length)
      setCustomersToday(customersTodayResult.count || 0)
      setCustomersThisWeek(customersWeekResult.count || 0)
      setCustomersThisMonth(customersMonthResult.count || 0)
      setTotalCalls(calls.length)

      const totalMinutes = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / 60
      setTotalCallMinutes(Math.round(totalMinutes))

      // Calculate daily stats for chart
      const dailyMap = new Map<string, DailyStats>()

      // Initialize days
      const daysInRange = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365
      for (let i = daysInRange - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        dailyMap.set(dateStr, { date: dateStr, customers: 0, calls: 0, callMinutes: 0 })
      }

      // Count customers per day
      customers.forEach(c => {
        const dateStr = c.created_at.split('T')[0]
        const stat = dailyMap.get(dateStr)
        if (stat) stat.customers++
      })

      // Count calls per day
      calls.forEach(c => {
        const dateStr = c.created_at.split('T')[0]
        const stat = dailyMap.get(dateStr)
        if (stat) {
          stat.calls++
          stat.callMinutes += (c.duration_seconds || 0) / 60
        }
      })

      setDailyStats(Array.from(dailyMap.values()).slice(-14)) // Last 14 days for readability

      // Calculate campaign performance
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

      // Get leads to map calls to campaigns
      const { data: leads } = await supabase
        .from('leads')
        .select('id, campaign_id')

      const leadCampaignMap = new Map<string, string>()
      leads?.forEach(l => leadCampaignMap.set(l.id, l.campaign_id))

      // Count customers per campaign
      customers.forEach(c => {
        if (c.campaign_id) {
          const stat = campaignStatsMap.get(c.campaign_id)
          if (stat) stat.customers++
        }
      })

      // Count calls per campaign via leads
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

      // Calculate metrics
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

      // Calculate bureau performance
      const bureauStatsMap = new Map<string, BureauPerformance>()
      bureaus.forEach(b => {
        bureauStatsMap.set(b.id, { id: b.id, name: b.name, customers: 0, revenue: 0 })
      })

      customers.forEach(c => {
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

    } catch (error) {
      console.error('Error fetching stats:', error)
      toast.error('Kunne ikke hente statistik')
    } finally {
      setLoading(false)
    }
  }

  // Calculate derived metrics
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

  const goalProgress = useMemo(() => {
    return Math.min(100, Math.round((customersToday / dailyGoal) * 100))
  }, [customersToday, dailyGoal])

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
            Din performance og indtjening i realtid
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
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

          <Button
            variant="secondary"
            size="sm"
            icon={<Settings className="w-4 h-4" />}
            onClick={() => setShowGoalModal(true)}
          >
            Sæt Mål
          </Button>
        </div>
      </div>

      {/* Daily Goal Progress */}
      <Card className="bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 text-white">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <Target className="w-8 h-8" />
              </div>
              <div>
                <p className="text-white/80 text-sm">Dagligt Mål</p>
                <p className="text-3xl font-bold">
                  {customersToday} / {dailyGoal}
                </p>
                <p className="text-white/60 text-sm mt-1">
                  {dailyGoal - customersToday > 0
                    ? `${dailyGoal - customersToday} kunder tilbage`
                    : 'Mål nået! Godt arbejde!'}
                </p>
              </div>
            </div>

            <div className="flex-1 max-w-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/80">Fremgang</span>
                <span className="text-sm font-medium">{goalProgress}%</span>
              </div>
              <div className="h-4 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
            </div>

            {goalProgress >= 100 && (
              <div className="flex items-center gap-2 bg-white/20 rounded-lg px-4 py-2">
                <Trophy className="w-5 h-5 text-yellow-300" />
                <span className="font-medium">Mål Nået!</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Estimeret Løn"
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

      {/* Revenue per Minute Highlight */}
      <Card>
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Performance Chart */}
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

        {/* Call Minutes Chart */}
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

      {/* Campaign Performance Ranking */}
      <Card>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bureau Ranking */}
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
      <Card>
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Månedens løn</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary-500" />
                Sæt Dagligt Mål
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Antal kunder per dag
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Dit nuværende mål: {dailyGoal} kunder/dag
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowGoalModal(false)}
                    disabled={savingGoal}
                  >
                    Annuller
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={saveDailyGoal}
                    icon={<CheckCircle className="w-4 h-4" />}
                    loading={savingGoal}
                  >
                    Gem Mål
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

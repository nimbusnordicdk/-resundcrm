import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui'
import {
  Users,
  TrendingUp,
  DollarSign,
  Target,
  CheckCircle,
  UserPlus,
} from 'lucide-react'

export default async function BureauDashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  // Hent bureau for bruger
  const { data: userData } = await supabase
    .from('users')
    .select('bureau_id')
    .eq('id', authUser?.id)
    .single()

  const bureauId = userData?.bureau_id

  const startOfMonth = new Date()
  startOfMonth.setDate(1)

  const [
    { count: activeCustomers },
    { count: customersThisMonth },
    { count: totalLeads },
    { data: invoices },
    { count: allCustomersCount },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('bureau_id', bureauId)
      .eq('status', 'aktiv'),
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('bureau_id', bureauId)
      .gte('created_at', startOfMonth.toISOString()),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .in('campaign_id', (
        await supabase.from('campaigns').select('id').eq('bureau_id', bureauId)
      ).data?.map((c) => c.id) || []),
    supabase
      .from('invoices')
      .select('amount')
      .eq('bureau_id', bureauId),
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('bureau_id', bureauId),
  ])

  const totalInvoiced = invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0
  const closeRate = totalLeads && totalLeads > 0
    ? Math.round(((activeCustomers || 0) / totalLeads) * 100)
    : 0

  const stats = [
    {
      title: 'Aktive Kunder',
      value: activeCustomers || 0,
      icon: Users,
      iconColor: 'bg-success',
    },
    {
      title: 'Kunder Lukket Denne Md.',
      value: customersThisMonth || 0,
      icon: UserPlus,
      iconColor: 'bg-primary-600',
    },
    {
      title: 'Antal Leads',
      value: totalLeads || 0,
      icon: Target,
      iconColor: 'bg-info',
    },
    {
      title: 'Lukke Rate',
      value: `${closeRate}%`,
      icon: TrendingUp,
      iconColor: 'bg-warning',
    },
    {
      title: 'Total Faktureret',
      value: `${totalInvoiced.toLocaleString('da-DK')} kr`,
      icon: DollarSign,
      iconColor: 'bg-success',
    },
    {
      title: 'Alle Kunder',
      value: allCustomersCount || 0,
      icon: CheckCircle,
      iconColor: 'bg-primary-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Velkommen til dit bureau dashboard</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            iconColor={stat.iconColor}
          />
        ))}
      </div>
    </div>
  )
}

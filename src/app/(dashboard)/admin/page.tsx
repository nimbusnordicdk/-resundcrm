import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui'
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  Phone,
  FileText,
  Target,
  CheckCircle,
  UserPlus,
  UserMinus,
  FileSignature,
  AlertCircle,
  Trophy,
} from 'lucide-react'

interface Activity {
  id: string
  type: 'customer_closed' | 'customer_churned' | 'contract_signed' | 'lead_lost'
  title: string
  description: string
  timestamp: string
  icon: typeof CheckCircle
  iconColor: string
  bgColor: string
}

interface TopSaelger {
  id: string
  full_name: string
  avatar_url?: string
  customers_closed: number
  total_calls: number
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Hent statistik
  const [
    { count: bureauCount },
    { count: saelgerCount },
    { count: activeCustomers },
    { count: totalLeads },
    { data: invoices },
    { count: contractsCount },
    { count: callsToday },
  ] = await Promise.all([
    supabase.from('bureaus').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'saelger'),
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('status', 'aktiv'),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('invoices').select('amount'),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'underskrevet'),
    supabase.from('call_logs').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().split('T')[0]),
  ])

  // Hent seneste aktivitet (lukkede kunder, opsagte, kontrakter underskrevet, tabte leads)
  const [
    { data: recentClosedCustomers },
    { data: recentChurnedCustomers },
    { data: recentContracts },
    { data: recentLostLeads },
  ] = await Promise.all([
    // Nyligt lukkede kunder (kontrakt underskrevet)
    supabase
      .from('customers')
      .select('id, name, contract_signed_at, saelger:users!customers_saelger_id_fkey(full_name)')
      .not('contract_signed_at', 'is', null)
      .order('contract_signed_at', { ascending: false })
      .limit(5),
    // Opsagte kunder
    supabase
      .from('customers')
      .select('id, name, terminated_at, termination_reason, saelger:users!customers_saelger_id_fkey(full_name)')
      .eq('status', 'opsagt')
      .not('terminated_at', 'is', null)
      .order('terminated_at', { ascending: false })
      .limit(5),
    // Underskrevne kontrakter
    supabase
      .from('contracts')
      .select('id, name, signed_at, signer_name')
      .eq('status', 'underskrevet')
      .not('signed_at', 'is', null)
      .order('signed_at', { ascending: false })
      .limit(5),
    // Tabte leads
    supabase
      .from('leads')
      .select('id, name, company, updated_at, lost_reason')
      .eq('status', 'lead_tabt')
      .order('updated_at', { ascending: false })
      .limit(5),
  ])

  // Byg aktivitetsliste
  const activities: Activity[] = []

  recentClosedCustomers?.forEach((c: any) => {
    activities.push({
      id: `closed-${c.id}`,
      type: 'customer_closed',
      title: 'Ny kunde lukket',
      description: `${c.name} er blevet kunde${c.saelger?.full_name ? ` (${c.saelger.full_name})` : ''}`,
      timestamp: c.contract_signed_at,
      icon: UserPlus,
      iconColor: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    })
  })

  recentChurnedCustomers?.forEach((c: any) => {
    activities.push({
      id: `churned-${c.id}`,
      type: 'customer_churned',
      title: 'Kunde opsagt',
      description: `${c.name}${c.termination_reason ? `: ${c.termination_reason}` : ''}`,
      timestamp: c.terminated_at,
      icon: UserMinus,
      iconColor: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
    })
  })

  recentContracts?.forEach((c: any) => {
    activities.push({
      id: `contract-${c.id}`,
      type: 'contract_signed',
      title: 'Kontrakt underskrevet',
      description: `${c.name}${c.signer_name ? ` af ${c.signer_name}` : ''}`,
      timestamp: c.signed_at,
      icon: FileSignature,
      iconColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    })
  })

  recentLostLeads?.forEach((l: any) => {
    activities.push({
      id: `lost-${l.id}`,
      type: 'lead_lost',
      title: 'Lead tabt',
      description: `${l.name}${l.company ? ` (${l.company})` : ''}${l.lost_reason ? `: ${l.lost_reason}` : ''}`,
      timestamp: l.updated_at,
      icon: AlertCircle,
      iconColor: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    })
  })

  // Sorter efter tidspunkt
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Hent top sælgere (baseret på antal lukkede kunder)
  const { data: saelgere } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .eq('role', 'saelger')

  const topSaelgere: TopSaelger[] = []

  if (saelgere) {
    for (const s of saelgere) {
      // Tæl lukkede kunder for denne sælger
      const { count: customersCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('saelger_id', s.id)
        .eq('status', 'aktiv')

      // Tæl opkald for denne sælger
      const { count: callsCount } = await supabase
        .from('call_logs')
        .select('*', { count: 'exact', head: true })
        .eq('saelger_id', s.id)

      topSaelgere.push({
        id: s.id,
        full_name: s.full_name,
        avatar_url: s.avatar_url,
        customers_closed: customersCount || 0,
        total_calls: callsCount || 0,
      })
    }
  }

  // Sorter efter antal lukkede kunder
  topSaelgere.sort((a, b) => b.customers_closed - a.customers_closed)

  const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0

  const stats = [
    {
      title: 'Aktive Bureauer',
      value: bureauCount || 0,
      icon: Building2,
      iconColor: 'bg-primary-600',
    },
    {
      title: 'Sælgere',
      value: saelgerCount || 0,
      icon: Users,
      iconColor: 'bg-info',
    },
    {
      title: 'Aktive Kunder',
      value: activeCustomers || 0,
      icon: CheckCircle,
      iconColor: 'bg-success',
    },
    {
      title: 'Totale Leads',
      value: totalLeads || 0,
      icon: Target,
      iconColor: 'bg-warning',
    },
    {
      title: 'Total Omsætning',
      value: `${totalRevenue.toLocaleString('da-DK')} kr`,
      icon: DollarSign,
      iconColor: 'bg-success',
    },
    {
      title: 'Underskrevne Kontrakter',
      value: contractsCount || 0,
      icon: FileText,
      iconColor: 'bg-primary-600',
    },
    {
      title: 'Opkald i Dag',
      value: callsToday || 0,
      icon: Phone,
      iconColor: 'bg-info',
    },
    {
      title: 'Lukke Rate',
      value: totalLeads ? `${Math.round(((activeCustomers || 0) / totalLeads) * 100)}%` : '0%',
      icon: TrendingUp,
      iconColor: 'bg-success',
    },
  ]

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Lige nu'
    if (diffMins < 60) return `${diffMins} min siden`
    if (diffHours < 24) return `${diffHours} timer siden`
    if (diffDays === 1) return 'I går'
    if (diffDays < 7) return `${diffDays} dage siden`
    return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Velkommen til Øresund Partners CRM</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Additional sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Seneste Aktivitet</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {activities.length === 0 ? (
              <div className="p-6">
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">Ingen seneste aktivitet</p>
              </div>
            ) : (
              activities.slice(0, 8).map((activity) => {
                const Icon = activity.icon
                return (
                  <div key={activity.id} className="px-6 py-4 flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full ${activity.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${activity.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {activity.description}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Top Performers */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Sælgere</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {topSaelgere.length === 0 ? (
              <div className="p-6">
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">Ingen sælgere endnu</p>
              </div>
            ) : (
              topSaelgere.slice(0, 5).map((saelger, index) => (
                <div key={saelger.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    {index < 3 && (
                      <div className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-400 text-yellow-900' :
                        index === 1 ? 'bg-gray-300 text-gray-700' :
                        'bg-orange-400 text-orange-900'
                      }`}>
                        {index + 1}
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                      {saelger.avatar_url ? (
                        <img
                          src={saelger.avatar_url}
                          alt={saelger.full_name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white text-sm font-medium">
                          {saelger.full_name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {saelger.full_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {saelger.total_calls} opkald
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {saelger.customers_closed}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">kunder</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

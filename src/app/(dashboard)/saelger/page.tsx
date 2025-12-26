import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui'
import {
  Target,
  Users,
  CheckCircle,
  Calendar,
  TrendingUp,
  Phone,
} from 'lucide-react'

export default async function SaelgerDashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  // Dagens mål (kan konfigureres)
  const dailyGoal = 5
  const weeklyGoal = 25

  // Hent statistik for sælger
  const today = new Date().toISOString().split('T')[0]
  const startOfWeek = new Date()
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  const startOfMonth = new Date()
  startOfMonth.setDate(1)

  const [
    { count: customersToday },
    { count: customersThisMonth },
    { count: callsToday },
    { data: todayMeetings },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('saelger_id', authUser?.id)
      .gte('created_at', today),
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('saelger_id', authUser?.id)
      .gte('created_at', startOfMonth.toISOString()),
    supabase
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('saelger_id', authUser?.id)
      .gte('created_at', today),
    supabase
      .from('meetings')
      .select('*')
      .eq('saelger_id', authUser?.id)
      .eq('date', today)
      .order('time', { ascending: true }),
  ])

  const stats = [
    {
      title: 'Dagens Mål',
      value: `${customersToday || 0}/${dailyGoal}`,
      icon: Target,
      iconColor: 'bg-primary-600',
      description: `${dailyGoal - (customersToday || 0)} tilbage`,
    },
    {
      title: 'Ugens Mål',
      value: `${customersThisMonth || 0}/${weeklyGoal}`,
      icon: TrendingUp,
      iconColor: 'bg-info',
    },
    {
      title: 'Kunder Lukket Denne Md.',
      value: customersThisMonth || 0,
      icon: Users,
      iconColor: 'bg-success',
    },
    {
      title: 'Kunder Lukket I Dag',
      value: customersToday || 0,
      icon: CheckCircle,
      iconColor: 'bg-success',
    },
    {
      title: 'Opkald I Dag',
      value: callsToday || 0,
      icon: Phone,
      iconColor: 'bg-warning',
    },
    {
      title: 'Møder I Dag',
      value: todayMeetings?.length || 0,
      icon: Calendar,
      iconColor: 'bg-primary-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Din daglige oversigt</p>
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
            description={stat.description}
          />
        ))}
      </div>

      {/* Today's Meetings */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-500 dark:text-primary-400" />
            Dagens Møder
          </h2>
        </div>
        <div className="p-6">
          {todayMeetings && todayMeetings.length > 0 ? (
            <div className="space-y-3">
              {todayMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-dark-hover"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{meeting.title}</p>
                    {meeting.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {meeting.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-primary-600 dark:text-primary-400 font-medium">{meeting.time}</p>
                    {meeting.google_meet_link && (
                      <a
                        href={meeting.google_meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-info hover:underline"
                      >
                        Åbn møde
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              Ingen møder planlagt i dag
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

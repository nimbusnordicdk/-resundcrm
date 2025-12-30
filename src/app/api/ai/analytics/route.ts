import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Fetch all relevant data from Supabase for AI analysis
async function fetchAnalyticsData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials not configured')
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const [
    usersResult,
    customersResult,
    leadsResult,
    bureausResult,
    invoicesResult,
    callLogsResult,
    campaignsResult,
    lessonsResult,
    lessonProgressResult,
    quizzesResult,
    quizAttemptsResult,
  ] = await Promise.all([
    supabase.from('users').select('*'),
    supabase.from('customers').select('*'),
    supabase.from('leads').select('*'),
    supabase.from('bureaus').select('*'),
    supabase.from('invoices').select('*'),
    supabase.from('call_logs').select('*'),
    supabase.from('campaigns').select('*'),
    supabase.from('lessons').select('*'),
    supabase.from('lesson_progress').select('*'),
    supabase.from('quizzes').select('*'),
    supabase.from('quiz_attempts').select('*'),
  ])

  // Log errors for debugging
  if (usersResult.error) console.error('Users error:', usersResult.error)
  if (customersResult.error) console.error('Customers error:', customersResult.error)
  if (leadsResult.error) console.error('Leads error:', leadsResult.error)
  if (bureausResult.error) console.error('Bureaus error:', bureausResult.error)
  if (invoicesResult.error) console.error('Invoices error:', invoicesResult.error)
  if (callLogsResult.error) console.error('CallLogs error:', callLogsResult.error)
  if (campaignsResult.error) console.error('Campaigns error:', campaignsResult.error)
  if (lessonsResult.error) console.error('Lessons error:', lessonsResult.error)
  if (lessonProgressResult.error) console.error('LessonProgress error:', lessonProgressResult.error)
  if (quizzesResult.error) console.error('Quizzes error:', quizzesResult.error)
  if (quizAttemptsResult.error) console.error('QuizAttempts error:', quizAttemptsResult.error)

  // Process data for analysis
  const users = usersResult.data || []
  const customers = customersResult.data || []
  const leads = leadsResult.data || []
  const bureaus = bureausResult.data || []
  const invoices = invoicesResult.data || []
  const callLogs = callLogsResult.data || []
  const campaigns = campaignsResult.data || []
  const lessons = lessonsResult.data || []
  const lessonProgress = lessonProgressResult.data || []
  const quizzes = quizzesResult.data || []
  const quizAttempts = quizAttemptsResult.data || []

  console.log('Data counts:', {
    users: users.length,
    customers: customers.length,
    leads: leads.length,
    bureaus: bureaus.length,
    invoices: invoices.length,
    callLogs: callLogs.length,
    campaigns: campaigns.length,
    lessons: lessons.length,
    lessonProgress: lessonProgress.length,
    quizzes: quizzes.length,
    quizAttempts: quizAttempts.length,
  })

  // Create name mappings
  const userNames = Object.fromEntries(users.map(u => [u.id, u.full_name]))
  const bureauNames = Object.fromEntries(bureaus.map(b => [b.id, b.name]))
  const campaignNames = Object.fromEntries(campaigns.map(c => [c.id, c.name]))
  const lessonNames = Object.fromEntries(lessons.map(l => [l.id, l.title]))

  // Calculate statistics
  const saelgere = users.filter(u => u.role === 'saelger')

  const saelgerStats = saelgere.map(s => {
    const saelgerCustomers = customers.filter(c => c.saelger_id === s.id)
    const saelgerLeads = leads.filter(l => l.assigned_saelger_id === s.id)
    const saelgerCalls = callLogs.filter(c => c.saelger_id === s.id)
    const saelgerInvoices = invoices.filter(i =>
      saelgerCustomers.some(c => c.id === i.customer_id)
    )

    // E-learning stats for this saelger
    const saelgerProgress = lessonProgress.filter(p => p.user_id === s.id)
    const completedLessons = saelgerProgress.filter(p => p.is_completed).length
    const saelgerQuizAttempts = quizAttempts.filter(q => q.user_id === s.id)
    const passedQuizzes = saelgerQuizAttempts.filter(q => q.is_passed).length
    const avgQuizScore = saelgerQuizAttempts.length > 0
      ? Math.round(saelgerQuizAttempts.reduce((sum, q) => sum + (q.score || 0), 0) / saelgerQuizAttempts.length)
      : 0

    const totalRevenue = saelgerInvoices.reduce((sum, i) => sum + (i.amount || 0), 0)
    const activeCustomers = saelgerCustomers.filter(c => c.status === 'aktiv').length
    const churnedCustomers = saelgerCustomers.filter(c => c.status === 'opsagt').length
    const convertedLeads = saelgerLeads.filter(l => l.status === 'kunde').length
    const lostLeads = saelgerLeads.filter(l => l.status === 'lead_tabt').length
    const totalCallMinutes = saelgerCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / 60

    return {
      name: s.full_name,
      id: s.id,
      totalCustomers: saelgerCustomers.length,
      activeCustomers,
      churnedCustomers,
      totalLeads: saelgerLeads.length,
      convertedLeads,
      lostLeads,
      conversionRate: saelgerLeads.length > 0 ? ((convertedLeads / saelgerLeads.length) * 100).toFixed(1) : '0',
      totalRevenue,
      totalCalls: saelgerCalls.length,
      totalCallMinutes: Math.round(totalCallMinutes),
      commission: s.commission_percent,
      // E-learning
      completedLessons,
      totalLessonsStarted: saelgerProgress.length,
      quizAttempts: saelgerQuizAttempts.length,
      passedQuizzes,
      avgQuizScore,
    }
  })

  const bureauStats = bureaus.map(b => {
    const bureauCustomers = customers.filter(c => c.bureau_id === b.id)
    const bureauInvoices = invoices.filter(i =>
      bureauCustomers.some(c => c.id === i.customer_id)
    )

    const activeCustomers = bureauCustomers.filter(c => c.status === 'aktiv').length
    const churnedCustomers = bureauCustomers.filter(c => c.status === 'opsagt').length
    const totalRevenue = bureauInvoices.reduce((sum, i) => sum + (i.amount || 0), 0)
    const churnRate = bureauCustomers.length > 0
      ? ((churnedCustomers / bureauCustomers.length) * 100).toFixed(1)
      : '0'

    return {
      name: b.name,
      id: b.id,
      totalCustomers: bureauCustomers.length,
      activeCustomers,
      churnedCustomers,
      churnRate,
      totalRevenue,
      avgLTV: bureauCustomers.length > 0 ? Math.round(totalRevenue / bureauCustomers.length) : 0,
    }
  })

  // Overall stats
  const totalCustomers = customers.length
  const activeCustomers = customers.filter(c => c.status === 'aktiv').length
  const churnedCustomers = customers.filter(c => c.status === 'opsagt').length
  const pendingCustomers = customers.filter(c => c.status === 'afventer_bekraeftelse').length
  const totalLeads = leads.length
  const convertedLeads = leads.filter(l => l.status === 'kunde').length
  const lostLeads = leads.filter(l => l.status === 'lead_tabt').length
  const newLeads = leads.filter(l => l.status === 'nyt_lead').length
  const contactedLeads = leads.filter(l => l.status === 'kontaktet').length
  const interestedLeads = leads.filter(l => l.status === 'interesseret').length
  const meetingBookedLeads = leads.filter(l => l.status === 'møde_booket').length
  const totalRevenue = invoices.reduce((sum, i) => sum + (i.amount || 0), 0)
  const avgLTV = totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0
  const overallConversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0'
  const overallChurnRate = totalCustomers > 0
    ? ((churnedCustomers / totalCustomers) * 100).toFixed(1)
    : '0'

  // E-learning overall stats
  const publishedLessons = lessons.filter(l => l.is_published)
  const mandatoryLessons = lessons.filter(l => l.is_mandatory)
  const totalLessonCompletions = lessonProgress.filter(p => p.is_completed).length
  const totalQuizAttempts = quizAttempts.length
  const passedQuizAttempts = quizAttempts.filter(q => q.is_passed).length
  const avgQuizScoreOverall = quizAttempts.length > 0
    ? Math.round(quizAttempts.reduce((sum, q) => sum + (q.score || 0), 0) / quizAttempts.length)
    : 0
  const quizPassRate = totalQuizAttempts > 0
    ? ((passedQuizAttempts / totalQuizAttempts) * 100).toFixed(1)
    : '0'

  // E-learning stats per lesson
  const lessonStats = lessons.map(lesson => {
    const progress = lessonProgress.filter(p => p.lesson_id === lesson.id)
    const completed = progress.filter(p => p.is_completed).length
    const quiz = quizzes.find(q => q.lesson_id === lesson.id)
    const attempts = quiz ? quizAttempts.filter(a => a.quiz_id === quiz.id) : []
    const passed = attempts.filter(a => a.is_passed).length
    const avgScore = attempts.length > 0
      ? Math.round(attempts.reduce((sum, a) => sum + (a.score || 0), 0) / attempts.length)
      : 0

    return {
      title: lesson.title,
      isMandatory: lesson.is_mandatory,
      isPublished: lesson.is_published,
      totalStarted: progress.length,
      totalCompleted: completed,
      completionRate: progress.length > 0 ? ((completed / progress.length) * 100).toFixed(1) : '0',
      hasQuiz: !!quiz,
      quizAttempts: attempts.length,
      quizPassed: passed,
      avgQuizScore: avgScore,
    }
  })

  return {
    overview: {
      totalSaelgere: saelgere.length,
      totalBureauer: bureaus.length,
      totalCustomers,
      activeCustomers,
      churnedCustomers,
      pendingCustomers,
      totalLeads,
      convertedLeads,
      lostLeads,
      newLeads,
      contactedLeads,
      interestedLeads,
      meetingBookedLeads,
      totalRevenue,
      avgLTV,
      overallConversionRate,
      overallChurnRate,
      totalCalls: callLogs.length,
      totalCampaigns: campaigns.length,
      // E-learning overview
      totalLessons: lessons.length,
      publishedLessons: publishedLessons.length,
      mandatoryLessons: mandatoryLessons.length,
      totalQuizzes: quizzes.length,
      totalLessonCompletions,
      totalQuizAttempts,
      passedQuizAttempts,
      avgQuizScoreOverall,
      quizPassRate,
    },
    saelgerStats,
    lessonStats,
    bureauStats,
    recentLeads: leads.slice(0, 20).map(l => ({
      name: l.name || l.company_name,
      status: l.status,
      saelger: userNames[l.assigned_saelger_id] || 'Ikke tildelt',
      campaign: campaignNames[l.campaign_id] || 'Ukendt',
    })),
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check - only admins can access analytics
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const { messages, query } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Fetch current data from Supabase
    const analyticsData = await fetchAnalyticsData()

    const systemPrompt = `Du er en data-analytiker for Øresund Partners CRM.
Du har adgang til følgende data om virksomheden:

=== OVERBLIK ===
- Antal sælgere: ${analyticsData.overview.totalSaelgere}
- Antal bureauer: ${analyticsData.overview.totalBureauer}
- Antal kampagner: ${analyticsData.overview.totalCampaigns}
- Total opkald: ${analyticsData.overview.totalCalls}

=== KUNDER ===
- Total kunder: ${analyticsData.overview.totalCustomers}
- Aktive kunder: ${analyticsData.overview.activeCustomers}
- Opsagte kunder: ${analyticsData.overview.churnedCustomers}
- Afventer bekræftelse: ${analyticsData.overview.pendingCustomers}
- Churn rate: ${analyticsData.overview.overallChurnRate}%

=== LEADS ===
- Total leads: ${analyticsData.overview.totalLeads}
- Nye leads: ${analyticsData.overview.newLeads}
- Kontaktede: ${analyticsData.overview.contactedLeads}
- Interesserede: ${analyticsData.overview.interestedLeads}
- Møde booket: ${analyticsData.overview.meetingBookedLeads}
- Konverteret til kunde: ${analyticsData.overview.convertedLeads}
- Tabte leads: ${analyticsData.overview.lostLeads}
- Konverteringsrate: ${analyticsData.overview.overallConversionRate}%

=== ØKONOMI ===
- Total omsætning: ${analyticsData.overview.totalRevenue.toLocaleString('da-DK')} kr
- Gennemsnitlig LTV: ${analyticsData.overview.avgLTV.toLocaleString('da-DK')} kr

=== SÆLGER STATISTIK ===
${analyticsData.saelgerStats.map(s => `
${s.name}:
- Kunder: ${s.totalCustomers} (${s.activeCustomers} aktive, ${s.churnedCustomers} churned)
- Leads: ${s.totalLeads} (${s.convertedLeads} konverteret, ${s.lostLeads} tabt)
- Konverteringsrate: ${s.conversionRate}%
- Omsætning genereret: ${s.totalRevenue.toLocaleString('da-DK')} kr
- Opkald: ${s.totalCalls} (${s.totalCallMinutes} minutter)
- Kommission: ${s.commission}%
- E-Learning: ${s.completedLessons} lektioner gennemført, ${s.passedQuizzes} quizzer bestået, gns. quiz score: ${s.avgQuizScore}%
`).join('\n')}

=== BUREAU STATISTIK ===
${analyticsData.bureauStats.map(b => `
${b.name}:
- Kunder: ${b.totalCustomers} (${b.activeCustomers} aktive)
- Churn rate: ${b.churnRate}%
- Total omsætning: ${b.totalRevenue.toLocaleString('da-DK')} kr
- Gennemsnitlig LTV: ${b.avgLTV.toLocaleString('da-DK')} kr
`).join('\n')}

=== E-LEARNING OVERBLIK ===
- Total lektioner: ${analyticsData.overview.totalLessons} (${analyticsData.overview.publishedLessons} publiceret, ${analyticsData.overview.mandatoryLessons} obligatoriske)
- Total quizzer: ${analyticsData.overview.totalQuizzes}
- Lektioner gennemført i alt: ${analyticsData.overview.totalLessonCompletions}
- Quiz forsøg i alt: ${analyticsData.overview.totalQuizAttempts} (${analyticsData.overview.passedQuizAttempts} bestået)
- Gennemsnitlig quiz score: ${analyticsData.overview.avgQuizScoreOverall}%
- Quiz bestået rate: ${analyticsData.overview.quizPassRate}%

=== LEKTION STATISTIK ===
${analyticsData.lessonStats.map(l => `
${l.title}${l.isMandatory ? ' (Obligatorisk)' : ''}${!l.isPublished ? ' [Ikke publiceret]' : ''}:
- Startet: ${l.totalStarted}, Gennemført: ${l.totalCompleted} (${l.completionRate}% gennemførelsesrate)
${l.hasQuiz ? `- Quiz: ${l.quizAttempts} forsøg, ${l.quizPassed} bestået, gns. score: ${l.avgQuizScore}%` : '- Ingen quiz'}
`).join('\n')}

=== SENESTE LEADS ===
${analyticsData.recentLeads.map(l => `- ${l.name}: ${l.status} (Sælger: ${l.saelger}, Kampagne: ${l.campaign})`).join('\n')}

Svar på dansk. Vær præcis og brug tal fra dataen. Giv konkrete anbefalinger baseret på dataen.
Du kan analysere e-learning data for at se sammenhænge mellem uddannelse og salgspræstation.
Hvis du ikke kan finde svaret i dataen, så sig det ærligt.
Formater tal pænt med tusindtalseparatorer (fx 1.234.567 kr).`

    const openai = new OpenAI({ apiKey: openaiApiKey })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.3,
      max_tokens: 1500,
    })

    const content = response.choices[0]?.message?.content || 'Kunne ikke analysere data'

    return NextResponse.json({ content })
  } catch (error) {
    console.error('AI analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze data' },
      { status: 500 }
    )
  }
}

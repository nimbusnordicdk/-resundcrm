'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Card,
  CardContent,
  Button,
} from '@/components/ui'
import {
  GraduationCap,
  Plus,
  BookOpen,
  Users,
  Trophy,
  Clock,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  BarChart3,
  TrendingUp,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Lesson {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  duration_minutes: number
  sort_order: number
  is_published: boolean
  is_mandatory: boolean
  created_at: string
}

interface LessonStats {
  lesson_id: string
  total_started: number
  total_completed: number
  avg_quiz_score: number
}

interface SellerStats {
  user_id: string
  full_name: string
  lessons_completed: number
  total_lessons: number
  avg_quiz_score: number
  last_activity: string | null
}

export default function UddannelsePage() {
  const supabase = createClient()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [lessonStats, setLessonStats] = useState<Record<string, LessonStats>>({})
  const [sellerStats, setSellerStats] = useState<SellerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'lessons' | 'stats'>('lessons')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    // Fetch lessons
    const { data: lessonsData, error: lessonsError } = await supabase
      .from('lessons')
      .select('*')
      .order('sort_order', { ascending: true })

    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError)
      toast.error('Kunne ikke hente lektioner')
    } else {
      setLessons(lessonsData || [])
    }

    // Fetch lesson stats
    const { data: progressData } = await supabase
      .from('lesson_progress')
      .select('lesson_id, is_completed')

    const { data: quizData } = await supabase
      .from('quiz_attempts')
      .select('quiz_id, score, quizzes!inner(lesson_id)')

    // Calculate stats per lesson
    const stats: Record<string, LessonStats> = {}
    if (progressData) {
      progressData.forEach(p => {
        if (!stats[p.lesson_id]) {
          stats[p.lesson_id] = { lesson_id: p.lesson_id, total_started: 0, total_completed: 0, avg_quiz_score: 0 }
        }
        stats[p.lesson_id].total_started++
        if (p.is_completed) stats[p.lesson_id].total_completed++
      })
    }

    if (quizData) {
      const quizScores: Record<string, number[]> = {}
      quizData.forEach((q: any) => {
        const lessonId = q.quizzes.lesson_id
        if (!quizScores[lessonId]) quizScores[lessonId] = []
        quizScores[lessonId].push(q.score)
      })
      Object.entries(quizScores).forEach(([lessonId, scores]) => {
        if (!stats[lessonId]) {
          stats[lessonId] = { lesson_id: lessonId, total_started: 0, total_completed: 0, avg_quiz_score: 0 }
        }
        stats[lessonId].avg_quiz_score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      })
    }
    setLessonStats(stats)

    // Fetch seller stats
    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'saelger')

    if (usersData && lessonsData) {
      const totalLessons = lessonsData.filter(l => l.is_published).length
      const sellerStatsMap: SellerStats[] = []

      for (const user of usersData) {
        const { data: userProgress } = await supabase
          .from('lesson_progress')
          .select('is_completed, updated_at')
          .eq('user_id', user.id)

        const { data: userQuizzes } = await supabase
          .from('quiz_attempts')
          .select('score')
          .eq('user_id', user.id)

        const lessonsCompleted = userProgress?.filter(p => p.is_completed).length || 0
        const avgScore = userQuizzes && userQuizzes.length > 0
          ? Math.round(userQuizzes.reduce((acc, q) => acc + q.score, 0) / userQuizzes.length)
          : 0
        const lastActivity = userProgress?.sort((a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0]?.updated_at || null

        sellerStatsMap.push({
          user_id: user.id,
          full_name: user.full_name,
          lessons_completed: lessonsCompleted,
          total_lessons: totalLessons,
          avg_quiz_score: avgScore,
          last_activity: lastActivity
        })
      }

      setSellerStats(sellerStatsMap.sort((a, b) => b.avg_quiz_score - a.avg_quiz_score))
    }

    setLoading(false)
  }

  async function togglePublish(lessonId: string, currentState: boolean) {
    const { error } = await supabase
      .from('lessons')
      .update({ is_published: !currentState })
      .eq('id', lessonId)

    if (error) {
      toast.error('Kunne ikke opdatere status')
    } else {
      toast.success(currentState ? 'Lektion skjult' : 'Lektion publiceret')
      fetchData()
    }
    setActiveMenu(null)
  }

  async function deleteLesson(lessonId: string) {
    if (!confirm('Er du sikker på at du vil slette denne lektion? Dette kan ikke fortrydes.')) return

    const { error } = await supabase
      .from('lessons')
      .delete()
      .eq('id', lessonId)

    if (error) {
      toast.error('Kunne ikke slette lektion')
    } else {
      toast.success('Lektion slettet')
      fetchData()
    }
    setActiveMenu(null)
  }

  // Overall stats
  const totalLessons = lessons.length
  const publishedLessons = lessons.filter(l => l.is_published).length
  const totalCompletions = Object.values(lessonStats).reduce((acc, s) => acc + s.total_completed, 0)
  const avgOverallScore = sellerStats.length > 0
    ? Math.round(sellerStats.reduce((acc, s) => acc + s.avg_quiz_score, 0) / sellerStats.filter(s => s.avg_quiz_score > 0).length) || 0
    : 0

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            Uddannelse
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Administrer lektioner og quizzer til salgsteamet
          </p>
        </div>
        <Link href="/admin/uddannelse/opret">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Opret Lektion
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalLessons}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Lektioner</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Eye className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{publishedLessons}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Publicerede</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalCompletions}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gennemført</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgOverallScore}%</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gns. Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-dark-border">
        <button
          onClick={() => setActiveTab('lessons')}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'lessons'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Lektioner
          </div>
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Sælger Statistik
          </div>
        </button>
      </div>

      {/* Lessons Tab */}
      {activeTab === 'lessons' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lessons.length === 0 ? (
            <div className="col-span-full">
              <Card>
                <CardContent className="py-16 text-center">
                  <GraduationCap className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Ingen lektioner endnu
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Opret din første lektion for at komme i gang med uddannelse
                  </p>
                  <Link href="/admin/uddannelse/opret">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Opret Lektion
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          ) : (
            lessons.map((lesson) => {
              const stats = lessonStats[lesson.id] || { total_started: 0, total_completed: 0, avg_quiz_score: 0 }
              return (
                <Card key={lesson.id} className="overflow-hidden group relative">
                  {/* Thumbnail */}
                  <div className="h-40 bg-gradient-to-br from-primary-500 to-primary-700 relative">
                    {lesson.thumbnail_url ? (
                      <img
                        src={lesson.thumbnail_url}
                        alt={lesson.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className="w-16 h-16 text-white/30" />
                      </div>
                    )}
                    {/* Status Badge */}
                    <div className="absolute top-3 left-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        lesson.is_published
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-500 text-white'
                      }`}>
                        {lesson.is_published ? 'Publiceret' : 'Kladde'}
                      </span>
                    </div>
                    {lesson.is_mandatory && (
                      <div className="absolute top-3 right-12">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-500 text-white">
                          Obligatorisk
                        </span>
                      </div>
                    )}
                    {/* Menu */}
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={() => setActiveMenu(activeMenu === lesson.id ? null : lesson.id)}
                        className="p-1.5 rounded-lg bg-black/30 text-white hover:bg-black/50 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {activeMenu === lesson.id && (
                        <div className="absolute right-0 top-8 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg py-1 min-w-[160px] z-10">
                          <Link
                            href={`/admin/uddannelse/${lesson.id}`}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
                          >
                            <Edit className="w-4 h-4" />
                            Rediger
                          </Link>
                          <button
                            onClick={() => togglePublish(lesson.id, lesson.is_published)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover w-full text-left"
                          >
                            {lesson.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            {lesson.is_published ? 'Skjul' : 'Publicer'}
                          </button>
                          <button
                            onClick={() => deleteLesson(lesson.id)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-dark-hover w-full text-left"
                          >
                            <Trash2 className="w-4 h-4" />
                            Slet
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-5">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-1">
                      {lesson.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                      {lesson.description || 'Ingen beskrivelse'}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {lesson.duration_minutes} min
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {stats.total_started} startet
                      </span>
                      {stats.avg_quiz_score > 0 && (
                        <span className="flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          {stats.avg_quiz_score}%
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Gennemført</span>
                        <span>{stats.total_completed} / {stats.total_started}</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-dark-hover rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{
                            width: stats.total_started > 0
                              ? `${(stats.total_completed / stats.total_started) * 100}%`
                              : '0%'
                          }}
                        />
                      </div>
                    </div>

                    <Link
                      href={`/admin/uddannelse/${lesson.id}`}
                      className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    >
                      Rediger lektion
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-500" />
              Sælger Fremgang
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-hover">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Sælger
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Lektioner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Fremgang
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Gns. Quiz Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Sidst Aktiv
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                {sellerStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      Ingen sælgerdata endnu
                    </td>
                  </tr>
                ) : (
                  sellerStats.map((seller, index) => (
                    <tr key={seller.user_id} className="hover:bg-gray-50 dark:hover:bg-dark-hover">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${
                            index === 0 ? 'bg-yellow-500' :
                            index === 1 ? 'bg-gray-400' :
                            index === 2 ? 'bg-amber-600' :
                            'bg-primary-500'
                          }`}>
                            {index < 3 ? (
                              <Trophy className="w-4 h-4" />
                            ) : (
                              seller.full_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {seller.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-900 dark:text-white">
                          {seller.lessons_completed} / {seller.total_lessons}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 dark:bg-dark-hover rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full"
                              style={{
                                width: seller.total_lessons > 0
                                  ? `${(seller.lessons_completed / seller.total_lessons) * 100}%`
                                  : '0%'
                              }}
                            />
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {seller.total_lessons > 0
                              ? Math.round((seller.lessons_completed / seller.total_lessons) * 100)
                              : 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-medium ${
                          seller.avg_quiz_score >= 80
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : seller.avg_quiz_score >= 60
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            : seller.avg_quiz_score > 0
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            : 'bg-gray-100 dark:bg-dark-hover text-gray-500 dark:text-gray-400'
                        }`}>
                          {seller.avg_quiz_score > 0 ? `${seller.avg_quiz_score}%` : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {seller.last_activity
                          ? new Date(seller.last_activity).toLocaleDateString('da-DK')
                          : 'Ingen aktivitet'
                        }
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

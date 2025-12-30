'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Card,
  CardContent,
} from '@/components/ui'
import {
  BookOpen,
  Clock,
  Trophy,
  CheckCircle2,
  Play,
  Lock,
  ChevronRight,
  Target,
  TrendingUp,
  Award,
  Star,
  Zap,
} from 'lucide-react'

interface Lesson {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  duration_minutes: number
  is_mandatory: boolean
  sort_order: number
}

interface LessonProgress {
  lesson_id: string
  current_page: number
  is_completed: boolean
  completed_at: string | null
}

interface QuizAttempt {
  quiz_id: string
  score: number
  is_passed: boolean
  completed_at: string
}

export default function ELearningPage() {
  const supabase = createClient()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({})
  const [quizResults, setQuizResults] = useState<Record<string, QuizAttempt[]>>({})
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    // Fetch published lessons
    const { data: lessonsData } = await supabase
      .from('lessons')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })

    if (lessonsData) {
      setLessons(lessonsData)
    }

    // Fetch user progress
    const { data: progressData } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('user_id', user.id)

    if (progressData) {
      const progressMap: Record<string, LessonProgress> = {}
      progressData.forEach(p => {
        progressMap[p.lesson_id] = p
      })
      setProgress(progressMap)
    }

    // Fetch quiz results
    const { data: quizData } = await supabase
      .from('quiz_attempts')
      .select('*, quizzes!inner(lesson_id)')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })

    if (quizData) {
      const resultsMap: Record<string, QuizAttempt[]> = {}
      quizData.forEach((q: any) => {
        const lessonId = q.quizzes.lesson_id
        if (!resultsMap[lessonId]) resultsMap[lessonId] = []
        resultsMap[lessonId].push(q)
      })
      setQuizResults(resultsMap)
    }

    setLoading(false)
  }

  // Calculate overall stats
  const completedLessons = Object.values(progress).filter(p => p.is_completed).length
  const totalLessons = lessons.length
  const completionRate = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  const allQuizScores = Object.values(quizResults).flat().map(q => q.score)
  const avgScore = allQuizScores.length > 0
    ? Math.round(allQuizScores.reduce((a, b) => a + b, 0) / allQuizScores.length)
    : 0

  const totalQuizzesPassed = Object.values(quizResults).flat().filter(q => q.is_passed).length

  // Determine skill level based on progress
  const getSkillLevel = () => {
    if (completionRate >= 80 && avgScore >= 80) return { level: 'Ekspert', color: 'text-yellow-500', icon: Award }
    if (completionRate >= 50 && avgScore >= 60) return { level: 'Avanceret', color: 'text-purple-500', icon: Star }
    if (completionRate >= 25) return { level: 'Øvet', color: 'text-blue-500', icon: Zap }
    return { level: 'Begynder', color: 'text-gray-500', icon: Target }
  }

  const skillLevel = getSkillLevel()
  const SkillIcon = skillLevel.icon

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          E-Learning
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Gennemfør lektioner og quizzer for at forbedre dine salgsfærdigheder
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Progress Card */}
        <Card className="bg-gradient-to-br from-primary-500 to-primary-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 opacity-80" />
              <span className="text-4xl font-bold">{completionRate}%</span>
            </div>
            <p className="text-white/80 text-sm">Samlet Fremgang</p>
            <div className="mt-3 h-2 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Completed Lessons */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {completedLessons}/{totalLessons}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gennemført</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quiz Score */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {avgScore}%
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gns. Quiz Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skill Level */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gray-100 dark:bg-dark-hover flex items-center justify-center`}>
                <SkillIcon className={`w-6 h-6 ${skillLevel.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${skillLevel.color}`}>
                  {skillLevel.level}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Dit Niveau</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lessons Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Tilgængelige Lektioner
        </h2>

        {lessons.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Ingen lektioner endnu
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Der er ingen tilgængelige lektioner på nuværende tidspunkt
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessons.map((lesson, index) => {
              const lessonProgress = progress[lesson.id]
              const lessonQuizzes = quizResults[lesson.id] || []
              const isCompleted = lessonProgress?.is_completed || false
              const isStarted = !!lessonProgress
              const bestQuizScore = lessonQuizzes.length > 0
                ? Math.max(...lessonQuizzes.map(q => q.score))
                : null
              const hasPassed = lessonQuizzes.some(q => q.is_passed)

              return (
                <Link key={lesson.id} href={`/saelger/e-learning/${lesson.id}`}>
                  <Card className="overflow-hidden group hover:shadow-lg transition-all cursor-pointer h-full">
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

                      {/* Status Overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform scale-90 group-hover:scale-100">
                          <Play className="w-6 h-6 text-primary-600 ml-1" />
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="absolute top-3 left-3 flex gap-2">
                        {isCompleted && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-500 text-white flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Gennemført
                          </span>
                        )}
                        {lesson.is_mandatory && !isCompleted && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-500 text-white">
                            Obligatorisk
                          </span>
                        )}
                      </div>

                      {/* Quiz Score Badge */}
                      {bestQuizScore !== null && (
                        <div className="absolute top-3 right-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${
                            hasPassed
                              ? 'bg-green-500 text-white'
                              : 'bg-yellow-500 text-white'
                          }`}>
                            <Trophy className="w-3 h-3" />
                            {bestQuizScore}%
                          </span>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 flex-1">
                          {lesson.title}
                        </h3>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
                      </div>

                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                        {lesson.description || 'Ingen beskrivelse'}
                      </p>

                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {lesson.duration_minutes} min
                        </span>
                        {isStarted && !isCompleted && (
                          <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                            <Play className="w-4 h-4" />
                            Fortsæt
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      {isStarted && (
                        <div className="mt-4">
                          <div className="h-1.5 bg-gray-200 dark:bg-dark-hover rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isCompleted ? 'bg-green-500' : 'bg-primary-500'
                              }`}
                              style={{ width: isCompleted ? '100%' : '50%' }}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent Quiz Results */}
      {Object.values(quizResults).flat().length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Seneste Quiz Resultater
            </h2>
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-200 dark:divide-dark-border">
              {Object.entries(quizResults)
                .flatMap(([lessonId, attempts]) =>
                  attempts.map(a => ({ ...a, lessonId, lessonTitle: lessons.find(l => l.id === lessonId)?.title }))
                )
                .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
                .slice(0, 5)
                .map((attempt, i) => (
                  <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-hover">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        attempt.is_passed
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        {attempt.is_passed ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <Trophy className="w-5 h-5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {attempt.lessonTitle}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(attempt.completed_at).toLocaleDateString('da-DK', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${
                        attempt.is_passed
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {attempt.score}%
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {attempt.is_passed ? 'Bestået' : 'Ikke bestået'}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

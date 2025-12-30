'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardContent,
  Button,
} from '@/components/ui'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Trophy,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Lesson {
  id: string
  title: string
  description: string | null
  duration_minutes: number
}

interface LessonPage {
  id: string
  title: string
  content: string
  page_number: number
}

interface Quiz {
  id: string
  title: string
  description: string | null
  passing_score: number
}

export default function LessonViewPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [pages, setPages] = useState<LessonPage[]>([])
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [progressId, setProgressId] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)

  useEffect(() => {
    fetchLesson()
  }, [params.id])

  async function fetchLesson() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/saelger/e-learning')
      return
    }

    // Fetch lesson
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', params.id)
      .eq('is_published', true)
      .single()

    if (lessonError || !lessonData) {
      toast.error('Kunne ikke hente lektion')
      router.push('/saelger/e-learning')
      return
    }

    setLesson(lessonData)

    // Fetch pages
    const { data: pagesData } = await supabase
      .from('lesson_pages')
      .select('*')
      .eq('lesson_id', params.id)
      .order('page_number', { ascending: true })

    if (pagesData) {
      setPages(pagesData)
    }

    // Fetch quiz
    const { data: quizData } = await supabase
      .from('quizzes')
      .select('*')
      .eq('lesson_id', params.id)
      .single()

    if (quizData) {
      setQuiz(quizData)
    }

    // Fetch or create progress
    const { data: progressData } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('lesson_id', params.id)
      .single()

    if (progressData) {
      setProgressId(progressData.id)
      setCurrentPage(progressData.current_page || 1)
      setIsCompleted(progressData.is_completed)
    } else {
      // Create progress entry
      const { data: newProgress } = await supabase
        .from('lesson_progress')
        .insert({
          user_id: user.id,
          lesson_id: params.id,
          current_page: 1,
          is_completed: false,
        })
        .select()
        .single()

      if (newProgress) {
        setProgressId(newProgress.id)
      }
    }

    setLoading(false)
  }

  async function updateProgress(pageNum: number, completed: boolean = false) {
    if (!progressId) return

    const updateData: any = { current_page: pageNum }
    if (completed) {
      updateData.is_completed = true
      updateData.completed_at = new Date().toISOString()
    }

    await supabase
      .from('lesson_progress')
      .update(updateData)
      .eq('id', progressId)
  }

  function goToPage(pageNum: number) {
    if (pageNum < 1 || pageNum > pages.length) return
    setCurrentPage(pageNum)
    updateProgress(pageNum)
  }

  async function completeLesson() {
    await updateProgress(pages.length, true)
    setIsCompleted(true)
    toast.success('Lektion gennemført!')

    if (quiz) {
      // Go to quiz
      router.push(`/saelger/e-learning/${params.id}/quiz`)
    } else {
      // No quiz, go back to overview
      router.push('/saelger/e-learning')
    }
  }

  // Content is now HTML from WYSIWYG editor, just return as-is
  function parseContent(content: string) {
    return content
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  const currentPageData = pages[currentPage - 1]
  const isLastPage = currentPage === pages.length

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/saelger/e-learning"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {lesson?.title}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {lesson?.duration_minutes} min
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              Side {currentPage} af {pages.length}
            </span>
            {isCompleted && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                Gennemført
              </span>
            )}
          </div>
        </div>
        {quiz && (
          <Link href={`/saelger/e-learning/${params.id}/quiz`}>
            <Button variant="secondary" size="sm">
              <HelpCircle className="w-4 h-4 mr-2" />
              Tag Quiz
            </Button>
          </Link>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          {pages.map((_, index) => (
            <button
              key={index}
              onClick={() => goToPage(index + 1)}
              className={`flex-1 h-2 rounded-full transition-colors ${
                index + 1 < currentPage
                  ? 'bg-green-500'
                  : index + 1 === currentPage
                  ? 'bg-primary-500'
                  : 'bg-gray-200 dark:bg-dark-hover'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <Card>
        <CardContent className="p-8">
          {currentPageData && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                {currentPageData.title}
              </h2>
              <div
                className="prose prose-lg dark:prose-invert max-w-none wysiwyg-content"
                dangerouslySetInnerHTML={{
                  __html: currentPageData.content
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="secondary"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Forrige
        </Button>

        <div className="flex items-center gap-2">
          {pages.map((_, index) => (
            <button
              key={index}
              onClick={() => goToPage(index + 1)}
              className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                index + 1 === currentPage
                  ? 'bg-primary-500 text-white'
                  : index + 1 < currentPage
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-400'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        {isLastPage ? (
          quiz ? (
            <Button onClick={completeLesson}>
              Gå til Quiz
              <Trophy className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={completeLesson}>
              Afslut Lektion
              <CheckCircle2 className="w-4 h-4 ml-2" />
            </Button>
          )
        ) : (
          <Button onClick={() => goToPage(currentPage + 1)}>
            Næste
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}

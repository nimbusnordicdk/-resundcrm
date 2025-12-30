'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import {
  Card,
  CardContent,
  Button,
  Input,
} from '@/components/ui'

// Simple Label component
function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
    >
      {children}
    </label>
  )
}
import {
  ArrowLeft,
  Save,
  BookOpen,
  Image,
  Clock,
  FileText,
  Plus,
  Trash2,
  GripVertical,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Eye,
  EyeOff,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { WYSIWYGEditor } from '@/components/forms/WYSIWYGEditor'

interface LessonPage {
  id?: string
  title: string
  content: string
  page_number: number
}

interface QuizQuestion {
  id?: string
  question: string
  question_type: 'multiple_choice' | 'true_false'
  options: { text: string; isCorrect: boolean }[]
  explanation: string
  points: number
  sort_order: number
}

export default function EditLektionPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<'info' | 'pages' | 'quiz'>('info')

  // Lesson Info
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(10)
  const [isMandatory, setIsMandatory] = useState(false)
  const [isPublished, setIsPublished] = useState(false)

  // Lesson Pages
  const [pages, setPages] = useState<LessonPage[]>([])

  // Quiz
  const [quizId, setQuizId] = useState<string | null>(null)
  const [quizTitle, setQuizTitle] = useState('')
  const [quizDescription, setQuizDescription] = useState('')
  const [passingScore, setPassingScore] = useState(70)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])

  useEffect(() => {
    fetchLesson()
  }, [params.id])

  async function fetchLesson() {
    setLoading(true)

    // Fetch lesson
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', params.id)
      .single()

    if (lessonError || !lesson) {
      toast.error('Kunne ikke hente lektion')
      router.push('/admin/uddannelse')
      return
    }

    setTitle(lesson.title)
    setDescription(lesson.description || '')
    setThumbnailUrl(lesson.thumbnail_url || '')
    setDurationMinutes(lesson.duration_minutes)
    setIsMandatory(lesson.is_mandatory)
    setIsPublished(lesson.is_published)

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
    const { data: quiz } = await supabase
      .from('quizzes')
      .select('*')
      .eq('lesson_id', params.id)
      .single()

    if (quiz) {
      setQuizId(quiz.id)
      setQuizTitle(quiz.title)
      setQuizDescription(quiz.description || '')
      setPassingScore(quiz.passing_score)

      // Fetch questions
      const { data: questionsData } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quiz.id)
        .order('sort_order', { ascending: true })

      if (questionsData) {
        setQuestions(questionsData.map(q => ({
          ...q,
          options: q.options as { text: string; isCorrect: boolean }[]
        })))
      }
    }

    setLoading(false)
  }

  function addPage() {
    setPages([...pages, {
      title: `Side ${pages.length + 1}`,
      content: '',
      page_number: pages.length + 1
    }])
  }

  function removePage(index: number) {
    if (pages.length === 1) {
      toast.error('Der skal være mindst én side')
      return
    }
    const newPages = pages.filter((_, i) => i !== index)
    setPages(newPages.map((p, i) => ({ ...p, page_number: i + 1 })))
  }

  function updatePage(index: number, field: keyof LessonPage, value: string) {
    const newPages = [...pages]
    newPages[index] = { ...newPages[index], [field]: value }
    setPages(newPages)
  }

  function addQuestion() {
    setQuestions([...questions, {
      question: '',
      question_type: 'multiple_choice',
      options: [
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ],
      explanation: '',
      points: 1,
      sort_order: questions.length
    }])
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  function updateQuestion(index: number, field: keyof QuizQuestion, value: any) {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], [field]: value }
    setQuestions(newQuestions)
  }

  function updateOption(questionIndex: number, optionIndex: number, field: 'text' | 'isCorrect', value: any) {
    const newQuestions = [...questions]
    const newOptions = [...newQuestions[questionIndex].options]

    if (field === 'isCorrect' && value === true) {
      newOptions.forEach((opt, i) => {
        opt.isCorrect = i === optionIndex
      })
    } else {
      newOptions[optionIndex] = { ...newOptions[optionIndex], [field]: value }
    }

    newQuestions[questionIndex].options = newOptions
    setQuestions(newQuestions)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim()) {
      toast.error('Indtast en titel')
      return
    }

    if (pages.some(p => !p.content.trim())) {
      toast.error('Alle sider skal have indhold')
      return
    }

    setSaving(true)

    try {
      // 1. Update lesson
      const { error: lessonError } = await supabase
        .from('lessons')
        .update({
          title,
          description,
          thumbnail_url: thumbnailUrl || null,
          duration_minutes: durationMinutes,
          is_mandatory: isMandatory,
          is_published: isPublished,
        })
        .eq('id', params.id)

      if (lessonError) throw lessonError

      // 2. Delete existing pages and recreate
      await supabase.from('lesson_pages').delete().eq('lesson_id', params.id)

      const pagesData = pages.map(p => ({
        lesson_id: params.id,
        title: p.title,
        content: p.content,
        page_number: p.page_number,
      }))

      const { error: pagesError } = await supabase
        .from('lesson_pages')
        .insert(pagesData)

      if (pagesError) throw pagesError

      // 3. Handle quiz
      if (questions.length > 0) {
        if (quizId) {
          // Update existing quiz
          await supabase
            .from('quizzes')
            .update({
              title: quizTitle || `Quiz: ${title}`,
              description: quizDescription,
              passing_score: passingScore,
            })
            .eq('id', quizId)

          // Delete existing questions and recreate
          await supabase.from('quiz_questions').delete().eq('quiz_id', quizId)
        } else {
          // Create new quiz
          const { data: newQuiz, error: quizError } = await supabase
            .from('quizzes')
            .insert({
              lesson_id: params.id,
              title: quizTitle || `Quiz: ${title}`,
              description: quizDescription,
              passing_score: passingScore,
            })
            .select()
            .single()

          if (quizError) throw quizError
          setQuizId(newQuiz.id)
        }

        // Create questions
        const currentQuizId = quizId || (await supabase.from('quizzes').select('id').eq('lesson_id', params.id).single()).data?.id

        if (currentQuizId) {
          const questionsData = questions.map((q, i) => ({
            quiz_id: currentQuizId,
            question: q.question,
            question_type: q.question_type,
            options: q.options,
            explanation: q.explanation,
            points: q.points,
            sort_order: i,
          }))

          const { error: questionsError } = await supabase
            .from('quiz_questions')
            .insert(questionsData)

          if (questionsError) throw questionsError
        }
      } else if (quizId) {
        // Remove quiz if no questions
        await supabase.from('quiz_questions').delete().eq('quiz_id', quizId)
        await supabase.from('quizzes').delete().eq('id', quizId)
        setQuizId(null)
      }

      toast.success('Lektion opdateret!')
      router.push('/admin/uddannelse')
    } catch (error: any) {
      console.error('Error updating lesson:', error)
      toast.error(error.message || 'Kunne ikke opdatere lektion')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/uddannelse"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Rediger Lektion
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-sm rounded-full ${
            isPublished
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-400'
          }`}>
            {isPublished ? 'Publiceret' : 'Kladde'}
          </span>
          <Button onClick={handleSubmit} loading={saving}>
            <Save className="w-4 h-4 mr-2" />
            Gem Ændringer
          </Button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-dark-border">
        <button
          onClick={() => setActiveSection('info')}
          className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeSection === 'info'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Information
        </button>
        <button
          onClick={() => setActiveSection('pages')}
          className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeSection === 'pages'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Sider ({pages.length})
        </button>
        <button
          onClick={() => setActiveSection('quiz')}
          className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeSection === 'quiz'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          Quiz ({questions.length} spørgsmål)
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Info Section */}
        {activeSection === 'info' && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="title">Titel *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Indtast lektionens titel"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">Beskrivelse</Label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Kort beskrivelse af lektionen"
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>

                <div>
                  <Label htmlFor="thumbnail">Thumbnail URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="thumbnail"
                      value={thumbnailUrl}
                      onChange={(e) => setThumbnailUrl(e.target.value)}
                      placeholder="https://..."
                    />
                    <button
                      type="button"
                      className="p-2 rounded-lg border border-gray-300 dark:border-dark-border hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
                    >
                      <Image className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="duration">Estimeret varighed (minutter)</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <Input
                      id="duration"
                      type="number"
                      min={1}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 10)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMandatory}
                      onChange={(e) => setIsMandatory(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Obligatorisk lektion</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Publiceret</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pages Section */}
        {activeSection === 'pages' && (
          <div className="space-y-4">
            {pages.map((page, index) => (
              <Card key={page.id || index}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-2 text-gray-400 cursor-move">
                      <GripVertical className="w-5 h-5" />
                      <span className="text-sm font-medium">Side {page.page_number}</span>
                    </div>
                    <div className="flex-1 space-y-4">
                      <Input
                        value={page.title}
                        onChange={(e) => updatePage(index, 'title', e.target.value)}
                        placeholder="Sidetitel"
                        className="font-medium"
                      />
                      <WYSIWYGEditor
                        content={page.content}
                        onChange={(content) => updatePage(index, 'content', content)}
                        placeholder="Skriv indholdet her..."
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePage(index)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <button
              type="button"
              onClick={addPage}
              className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-dark-border rounded-xl text-gray-500 dark:text-gray-400 hover:border-primary-500 hover:text-primary-500 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Tilføj ny side
            </button>
          </div>
        )}

        {/* Quiz Section */}
        {activeSection === 'quiz' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quiz Indstillinger</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="quizTitle">Quiz titel</Label>
                    <Input
                      id="quizTitle"
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      placeholder="Quiz titel (valgfrit)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="passingScore">Bestået score (%)</Label>
                    <Input
                      id="passingScore"
                      type="number"
                      min={0}
                      max={100}
                      value={passingScore}
                      onChange={(e) => setPassingScore(parseInt(e.target.value) || 70)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="quizDescription">Beskrivelse</Label>
                    <Input
                      id="quizDescription"
                      value={quizDescription}
                      onChange={(e) => setQuizDescription(e.target.value)}
                      placeholder="Kort beskrivelse"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {questions.map((question, qIndex) => (
              <Card key={question.id || qIndex}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-medium text-primary-600 dark:text-primary-400">
                        {qIndex + 1}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Multiple Choice
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>Spørgsmål</Label>
                      <textarea
                        value={question.question}
                        onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                        placeholder="Skriv dit spørgsmål her..."
                        rows={2}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
                      />
                    </div>

                    <div>
                      <Label>Svarmuligheder (klik for at markere korrekt svar)</Label>
                      <div className="space-y-2 mt-2">
                        {question.options.map((option, oIndex) => (
                          <div key={oIndex} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateOption(qIndex, oIndex, 'isCorrect', true)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                option.isCorrect
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-200 dark:bg-dark-hover text-gray-400 hover:bg-gray-300 dark:hover:bg-dark-border'
                              }`}
                            >
                              {option.isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                            </button>
                            <Input
                              value={option.text}
                              onChange={(e) => updateOption(qIndex, oIndex, 'text', e.target.value)}
                              placeholder={`Svar ${oIndex + 1}`}
                              className="flex-1"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Forklaring (vises efter svar)</Label>
                      <Input
                        value={question.explanation}
                        onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                        placeholder="Forklar hvorfor dette er det rigtige svar..."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <button
              type="button"
              onClick={addQuestion}
              className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-dark-border rounded-xl text-gray-500 dark:text-gray-400 hover:border-primary-500 hover:text-primary-500 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Tilføj spørgsmål
            </button>
          </div>
        )}

        <div className="mt-8 flex justify-end gap-4">
          <Link href="/admin/uddannelse">
            <Button type="button" variant="outline">
              Annuller
            </Button>
          </Link>
          <Button type="submit" loading={saving}>
            <Save className="w-4 h-4 mr-2" />
            Gem Ændringer
          </Button>
        </div>
      </form>
    </div>
  )
}

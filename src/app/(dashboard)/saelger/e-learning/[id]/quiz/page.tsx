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
  HelpCircle,
  CheckCircle2,
  XCircle,
  Trophy,
  Clock,
  ChevronRight,
  RotateCcw,
  Home,
  BookOpen,
  Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Quiz {
  id: string
  title: string
  description: string | null
  passing_score: number
  lesson_id: string
}

interface QuizQuestion {
  id: string
  question: string
  question_type: string
  options: { text: string; isCorrect: boolean }[]
  explanation: string
  points: number
  sort_order: number
}

interface Answer {
  questionId: string
  selectedOption: number
  isCorrect: boolean
}

export default function QuizPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [showExplanation, setShowExplanation] = useState(false)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [score, setScore] = useState(0)
  const [startTime] = useState(new Date())

  useEffect(() => {
    fetchQuiz()
  }, [params.id])

  async function fetchQuiz() {
    setLoading(true)

    // Fetch quiz
    const { data: quizData, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('lesson_id', params.id)
      .single()

    if (quizError || !quizData) {
      toast.error('Ingen quiz fundet')
      router.push(`/saelger/e-learning/${params.id}`)
      return
    }

    setQuiz(quizData)

    // Fetch questions
    const { data: questionsData } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizData.id)
      .order('sort_order', { ascending: true })

    if (questionsData) {
      setQuestions(questionsData.map(q => ({
        ...q,
        options: q.options as { text: string; isCorrect: boolean }[]
      })))
    }

    setLoading(false)
  }

  function handleOptionSelect(optionIndex: number) {
    if (showExplanation) return
    setSelectedOption(optionIndex)
  }

  function submitAnswer() {
    if (selectedOption === null) {
      toast.error('Vælg et svar')
      return
    }

    const question = questions[currentQuestion]
    const isCorrect = question.options[selectedOption].isCorrect

    setAnswers([...answers, {
      questionId: question.id,
      selectedOption,
      isCorrect
    }])

    setShowExplanation(true)
  }

  function nextQuestion() {
    if (currentQuestion === questions.length - 1) {
      // Quiz completed
      finishQuiz()
    } else {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedOption(null)
      setShowExplanation(false)
    }
  }

  async function finishQuiz() {
    // answers array already contains all answers including the last one (added in submitAnswer)
    const correctAnswers = answers.filter(a => a.isCorrect).length
    const totalQuestions = questions.length
    const calculatedScore = Math.round((correctAnswers / totalQuestions) * 100)
    const isPassed = calculatedScore >= (quiz?.passing_score || 70)

    setScore(calculatedScore)
    setQuizCompleted(true)

    // Save attempt
    const { data: { user } } = await supabase.auth.getUser()
    if (user && quiz) {
      const endTime = new Date()
      const timeSpent = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)

      await supabase.from('quiz_attempts').insert({
        user_id: user.id,
        quiz_id: quiz.id,
        score: calculatedScore,
        points_earned: correctAnswers,
        points_possible: totalQuestions,
        is_passed: isPassed,
        answers: answers,
        time_spent_seconds: timeSpent,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
      })
    }
  }

  function retryQuiz() {
    setCurrentQuestion(0)
    setSelectedOption(null)
    setAnswers([])
    setShowExplanation(false)
    setQuizCompleted(false)
    setScore(0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  // Quiz Completed View
  if (quizCompleted) {
    const isPassed = score >= (quiz?.passing_score || 70)
    const correctCount = answers.filter(a => a.isCorrect).length

    return (
      <div className="max-w-2xl mx-auto">
        <Card className="overflow-hidden">
          {/* Header */}
          <div className={`p-8 text-center ${
            isPassed
              ? 'bg-gradient-to-br from-green-500 to-green-700'
              : 'bg-gradient-to-br from-red-500 to-red-700'
          } text-white`}>
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
              {isPassed ? (
                <Trophy className="w-10 h-10" />
              ) : (
                <XCircle className="w-10 h-10" />
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2">
              {isPassed ? 'Tillykke!' : 'Ikke bestået'}
            </h1>
            <p className="text-white/80">
              {isPassed
                ? 'Du har bestået quizzen!'
                : `Du skal have mindst ${quiz?.passing_score}% for at bestå`
              }
            </p>
          </div>

          <CardContent className="p-8">
            {/* Score Display */}
            <div className="text-center mb-8">
              <div className="text-6xl font-bold text-gray-900 dark:text-white mb-2">
                {score}%
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                {correctCount} af {questions.length} rigtige svar
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center p-4 bg-gray-50 dark:bg-dark-hover rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-xl font-bold text-gray-900 dark:text-white">{correctCount}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Rigtige</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-dark-hover rounded-lg">
                <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                <p className="text-xl font-bold text-gray-900 dark:text-white">{questions.length - correctCount}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Forkerte</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-dark-hover rounded-lg">
                <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {Math.floor((new Date().getTime() - startTime.getTime()) / 60000)}m
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Tid brugt</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              {!isPassed && (
                <Button onClick={retryQuiz} variant="outline" className="flex-1">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Prøv igen
                </Button>
              )}
              <Link href={`/saelger/e-learning/${params.id}`} className="flex-1">
                <Button variant="outline" className="w-full">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Tilbage til lektion
                </Button>
              </Link>
              <Link href="/saelger/e-learning" className="flex-1">
                <Button className="w-full">
                  <Home className="w-4 h-4 mr-2" />
                  Alle lektioner
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const question = questions[currentQuestion]

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/saelger/e-learning/${params.id}`}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary-500" />
            {quiz?.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Spørgsmål {currentQuestion + 1} af {questions.length}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">Bestået score</p>
          <p className="font-bold text-gray-900 dark:text-white">{quiz?.passing_score}%</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1 mb-6">
        {questions.map((_, index) => {
          const answer = answers[index]
          return (
            <div
              key={index}
              className={`flex-1 h-2 rounded-full transition-colors ${
                index < currentQuestion
                  ? answer?.isCorrect
                    ? 'bg-green-500'
                    : 'bg-red-500'
                  : index === currentQuestion
                  ? 'bg-primary-500'
                  : 'bg-gray-200 dark:bg-dark-hover'
              }`}
            />
          )
        })}
      </div>

      {/* Question Card */}
      <Card>
        <CardContent className="p-8">
          {/* Question */}
          <div className="mb-8">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Spørgsmål {currentQuestion + 1}
            </span>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {question.question}
            </h2>
          </div>

          {/* Options */}
          <div className="space-y-3 mb-8">
            {question.options.map((option, index) => {
              const isSelected = selectedOption === index
              const showResult = showExplanation

              let optionClass = 'border-gray-200 dark:border-dark-border hover:border-primary-500 dark:hover:border-primary-500'
              if (showResult) {
                if (option.isCorrect) {
                  optionClass = 'border-green-500 bg-green-50 dark:bg-green-900/20'
                } else if (isSelected && !option.isCorrect) {
                  optionClass = 'border-red-500 bg-red-50 dark:bg-red-900/20'
                }
              } else if (isSelected) {
                optionClass = 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              }

              return (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(index)}
                  disabled={showExplanation}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${optionClass}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                    showResult
                      ? option.isCorrect
                        ? 'bg-green-500 text-white'
                        : isSelected
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 dark:bg-dark-hover text-gray-600 dark:text-gray-400'
                      : isSelected
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-dark-hover text-gray-600 dark:text-gray-400'
                  }`}>
                    {showResult ? (
                      option.isCorrect ? <CheckCircle2 className="w-5 h-5" /> : isSelected ? <XCircle className="w-5 h-5" /> : String.fromCharCode(65 + index)
                    ) : (
                      String.fromCharCode(65 + index)
                    )}
                  </div>
                  <span className={`flex-1 ${
                    showResult && option.isCorrect
                      ? 'text-green-700 dark:text-green-400 font-medium'
                      : showResult && isSelected && !option.isCorrect
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {option.text}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Explanation */}
          {showExplanation && question.explanation && (
            <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-1">Forklaring</h4>
              <p className="text-blue-700 dark:text-blue-400">
                {question.explanation}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {answers.filter(a => a.isCorrect).length} rigtige af {answers.length} besvaret
            </div>

            {!showExplanation ? (
              <Button onClick={submitAnswer} disabled={selectedOption === null}>
                Bekræft svar
                <CheckCircle2 className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={nextQuestion}>
                {currentQuestion === questions.length - 1 ? 'Se resultat' : 'Næste spørgsmål'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, Button } from '@/components/ui'
import { Sparkles, Send, User, Bot, Loader2, Database, TrendingUp, Users, Building2, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const exampleQueries = [
  { icon: Users, text: 'Hvem er den bedste sælger denne måned?' },
  { icon: TrendingUp, text: 'Hvad er gennemsnitlig LTV per kunde?' },
  { icon: GraduationCap, text: 'Hvilken sælger har lavest quiz score?' },
  { icon: GraduationCap, text: 'Er der sammenhæng mellem e-learning og salg?' },
]

export default function AdminAIPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(customInput?: string) {
    const messageText = customInput || input
    if (!messageText.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          query: messageText.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error('Kunne ikke få svar fra AI')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('AI analytics error:', error)
      toast.error('Kunne ikke få svar fra AI')
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ØresundAI Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400">Spørg om data, performance og indsigter</p>
        </div>
      </div>

      {/* Chat Area */}
      <Card className="flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-6" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                Velkommen til ØresundAI Analytics
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-lg mb-8">
                Stil spørgsmål om jeres data - sælgere, kunder, bureauer, omsætning, churn og meget mere.
                AI'en analyserer data fra Supabase og giver dig indsigter.
              </p>

              {/* Example queries */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                {exampleQueries.map((query, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(query.text)}
                    className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-dark-border hover:border-primary-300 dark:hover:border-primary-500/50 hover:bg-gray-50 dark:hover:bg-dark-hover transition-all text-left"
                  >
                    <query.icon className="w-5 h-5 text-primary-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{query.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-gray-100 dark:bg-dark-hover text-gray-900 dark:text-gray-100 rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-dark-border flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="bg-gray-100 dark:bg-dark-hover rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                  <span className="text-sm text-gray-500">Analyserer data...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-dark-border p-4">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Stil et spørgsmål om jeres data..."
              className="flex-1 input resize-none min-h-[44px] max-h-32"
              rows={1}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            >
              Send
            </Button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Tryk Enter for at sende • AI'en har adgang til sælgere, kunder, leads, bureauer, fakturaer, opkald og e-learning data
          </p>
        </div>
      </Card>
    </div>
  )
}

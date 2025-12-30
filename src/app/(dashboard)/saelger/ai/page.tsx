'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, Button } from '@/components/ui'
import { Sparkles, Send, User, Bot, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type CallType = 'kvalifikation' | 'salg' | 'opfoelgning' | 'indvending'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const callTypes: { value: CallType; label: string; description: string }[] = [
  { value: 'kvalifikation', label: 'Kvalifikationskald', description: 'Vurder om lead er kvalificeret' },
  { value: 'salg', label: 'Salgskald', description: 'Hjælp til at lukke salget' },
  { value: 'opfoelgning', label: 'Opfølgningskald', description: 'Strategier til opfølgning' },
  { value: 'indvending', label: 'Indvendingshåndtering', description: 'Håndter kundeindvendinger' },
]

const systemPrompts: Record<CallType, string> = {
  kvalifikation: `Du er en erfaren salgscoach hos Øresund Partners, specialiseret i B2B kvalifikationskald.
Din opgave er at hjælpe sælgere med at vurdere om et lead er kvalificeret.
Fokuser på: Budget, Authority (beslutningstagere), Need (behov), Timeline (tidshorisont).
Giv konkrete spørgsmål sælgeren kan stille og hjælp med at analysere svar.
Svar på dansk og vær direkte og handlingsorienteret.`,

  salg: `Du er en erfaren salgscoach hos Øresund Partners, specialiseret i at lukke B2B salg.
Din opgave er at hjælpe sælgere med at lukke deals.
Fokuser på: Værdiargumentation, urgency, håndtering af beslutningsprocessen.
Giv konkrete teknikker og formuleringer sælgeren kan bruge.
Svar på dansk og vær direkte og handlingsorienteret.`,

  opfoelgning: `Du er en erfaren salgscoach hos Øresund Partners, specialiseret i opfølgning på leads.
Din opgave er at hjælpe sælgere med at følge op effektivt uden at virke påtrængende.
Fokuser på: Timing, værditilføjelse i hver kontakt, forskellige kanaler.
Giv konkrete strategier og eksempler på opfølgningsbeskeder.
Svar på dansk og vær direkte og handlingsorienteret.`,

  indvending: `Du er en erfaren salgscoach hos Øresund Partners, specialiseret i håndtering af indvendinger.
Din opgave er at hjælpe sælgere med at overvinde kundeindvendinger.
Fokuser på: Lytte, anerkende, omformulere, løse.
Giv konkrete svar på typiske indvendinger som pris, tid, konkurrenter osv.
Svar på dansk og vær direkte og handlingsorienteret.`,
}

export default function OresundAIPage() {
  const [selectedType, setSelectedType] = useState<CallType>('kvalifikation')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset chat when changing type
  useEffect(() => {
    setMessages([])
  }, [selectedType])

  async function sendMessage() {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          systemPrompt: systemPrompts[selectedType],
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
      console.error('AI chat error:', error)
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ØresundAI</h1>
          <p className="text-gray-500 dark:text-gray-400">Din AI-assistent til salgsopkald</p>
        </div>
      </div>

      {/* Call Type Selection */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {callTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setSelectedType(type.value)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              selectedType === type.value
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                : 'border-gray-200 dark:border-dark-border hover:border-primary-300 dark:hover:border-primary-500/50'
            }`}
          >
            <p className={`font-medium ${
              selectedType === type.value
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-900 dark:text-white'
            }`}>
              {type.label}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{type.description}</p>
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <Card className="flex flex-col h-[calc(100vh-320px)] min-h-[400px]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Start en samtale
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Vælg opkaldstype ovenfor og stil et spørgsmål. Jeg kan hjælpe med strategier,
                formuleringer og feedback på dine opkald.
              </p>
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
                <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
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
              placeholder="Stil et spørgsmål eller paste en transskription..."
              className="flex-1 input resize-none min-h-[44px] max-h-32"
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            >
              Send
            </Button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Tryk Enter for at sende, Shift+Enter for ny linje
          </p>
        </div>
      </Card>
    </div>
  )
}

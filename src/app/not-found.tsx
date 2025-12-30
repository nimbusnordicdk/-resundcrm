'use client'

import Link from 'next/link'
import { Home, ArrowLeft, Search, HelpCircle } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50 dark:from-dark-bg dark:via-dark-card dark:to-dark-bg flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-600/30">
            <span className="text-white font-bold text-4xl">Ø</span>
          </div>
        </div>

        {/* 404 Number */}
        <div className="relative mb-6">
          <h1 className="text-[180px] md:text-[220px] font-black text-primary-600/10 dark:text-primary-400/10 leading-none select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-6xl md:text-7xl font-bold text-gray-900 dark:text-white">Hovsa!</p>
            </div>
          </div>
        </div>

        {/* Message */}
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white mb-4">
          Siden blev ikke fundet
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          Den side du leder efter eksisterer ikke eller er blevet flyttet.
          Lad os hjælpe dig tilbage på rette spor.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/30"
          >
            <Home className="w-5 h-5" />
            Gå til forsiden
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors border border-gray-200 dark:border-dark-border"
          >
            <ArrowLeft className="w-5 h-5" />
            Gå tilbage
          </button>
        </div>

        {/* Footer */}
        <p className="mt-8 text-sm text-gray-400 dark:text-gray-500">
          Øresund Partners &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

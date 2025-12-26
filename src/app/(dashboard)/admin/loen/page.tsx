'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  Select,
} from '@/components/ui'
import { DollarSign, Users } from 'lucide-react'
import type { User } from '@/types/database'

interface SaelgerSalary {
  saelger: User
  totalInvoiced: number
  commission: number
  salary: number
}

export default function LoenPage() {
  const [salaries, setSalaries] = useState<SaelgerSalary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const supabase = createClient()

  useEffect(() => {
    fetchSalaries()
  }, [selectedMonth, selectedYear])

  async function fetchSalaries() {
    setLoading(true)

    // Hent alle sælgere
    const { data: saelgere } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'saelger')

    if (!saelgere) {
      setLoading(false)
      return
    }

    // For hver sælger, beregn løn
    const salaryData = await Promise.all(
      saelgere.map(async (saelger) => {
        // Hent kunder lukket af sælger
        const { data: customers } = await supabase
          .from('customers')
          .select('id')
          .eq('saelger_id', saelger.id)

        if (!customers || customers.length === 0) {
          return {
            saelger,
            totalInvoiced: 0,
            commission: saelger.commission_percent || 20,
            salary: 0,
          }
        }

        // Hent fakturaer for disse kunder i valgt måned
        const { data: invoices } = await supabase
          .from('invoices')
          .select('amount')
          .in('customer_id', customers.map((c) => c.id))
          .eq('month', selectedMonth)
          .eq('year', selectedYear)

        const totalInvoiced = invoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0
        const commission = saelger.commission_percent || 20
        const salary = totalInvoiced * (commission / 100)

        return {
          saelger,
          totalInvoiced,
          commission,
          salary,
        }
      })
    )

    setSalaries(salaryData)
    setLoading(false)
  }

  const totalSalary = salaries.reduce((sum, s) => sum + s.salary, 0)
  const totalInvoiced = salaries.reduce((sum, s) => sum + s.totalInvoiced, 0)

  const months = [
    { value: '1', label: 'Januar' },
    { value: '2', label: 'Februar' },
    { value: '3', label: 'Marts' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Maj' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ]

  const years = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - i
    return { value: year.toString(), label: year.toString() }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Løn</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Oversigt over sælgeres løn</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedMonth.toString()}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            options={months}
            className="w-36"
          />
          <Select
            value={selectedYear.toString()}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            options={years}
            className="w-28"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Løn</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalSalary.toLocaleString('da-DK')} kr
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Faktureret</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalInvoiced.toLocaleString('da-DK')} kr
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-info flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Antal Sælgere</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{salaries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Salaries Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sælger</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Kommission %</TableHead>
              <TableHead>Total Faktureret</TableHead>
              <TableHead>Løn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                    Indlæser...
                  </div>
                </TableCell>
              </TableRow>
            ) : salaries.length === 0 ? (
              <TableEmpty message="Ingen sælgere fundet" />
            ) : (
              salaries.map((item) => (
                <TableRow key={item.saelger.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {item.saelger.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {item.saelger.full_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{item.saelger.email}</TableCell>
                  <TableCell>{item.commission}%</TableCell>
                  <TableCell>{item.totalInvoiced.toLocaleString('da-DK')} kr</TableCell>
                  <TableCell>
                    <span className="text-success-light font-semibold">
                      {item.salary.toLocaleString('da-DK')} kr
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

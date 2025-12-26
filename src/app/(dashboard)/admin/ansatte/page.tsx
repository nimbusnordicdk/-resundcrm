'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  Button,
  Modal,
  ModalFooter,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  Input,
} from '@/components/ui'
import { Plus, Users, Search, Phone, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import type { User } from '@/types/database'

export default function AnsattePage() {
  const [employees, setEmployees] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    cpr_nr: '',
    commission_percent: '20',
  })
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchEmployees()
  }, [])

  async function fetchEmployees() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'saelger')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Kunne ikke hente ansatte')
    } else {
      setEmployees(data || [])
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Opret auth bruger
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (authError) throw authError

      if (!authData.user) throw new Error('Kunne ikke oprette bruger')

      // Opret bruger i users tabellen
      const { error: userError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: formData.email,
        full_name: formData.full_name,
        phone: formData.phone || null,
        cpr_nr: formData.cpr_nr || null,
        commission_percent: parseFloat(formData.commission_percent),
        role: 'saelger',
      })

      if (userError) throw userError

      toast.success('Sælger oprettet!')
      setShowModal(false)
      setFormData({
        email: '',
        password: '',
        full_name: '',
        phone: '',
        cpr_nr: '',
        commission_percent: '20',
      })
      fetchEmployees()
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke oprette sælger')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alle Ansatte</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Administrer sælgere</p>
        </div>
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowModal(true)}
        >
          Tilføj Sælger
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Søg efter sælger..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sælger</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Kommission %</TableHead>
              <TableHead>Oprettet</TableHead>
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
            ) : filteredEmployees.length === 0 ? (
              <TableEmpty message="Ingen sælgere fundet" />
            ) : (
              filteredEmployees.map((emp) => (
                <TableRow
                  key={emp.id}
                  onClick={() => router.push(`/admin/ansatte/${emp.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {emp.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{emp.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      {emp.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      {emp.phone || '-'}
                    </div>
                  </TableCell>
                  <TableCell>{emp.commission_percent}%</TableCell>
                  <TableCell>
                    {new Date(emp.created_at).toLocaleDateString('da-DK')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add Employee Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Tilføj Ny Sælger"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Fulde Navn"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            required
            placeholder="Indtast sælgers navn"
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            placeholder="email@oresundpartners.dk"
          />

          <Input
            label="Adgangskode"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            placeholder="Minimum 6 tegn"
            minLength={6}
          />

          <Input
            label="CPR Nr"
            value={formData.cpr_nr}
            onChange={(e) => setFormData({ ...formData, cpr_nr: e.target.value })}
            placeholder="123456-1234"
          />

          <Input
            label="Telefon Nr"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+45 12 34 56 78"
          />

          <Input
            label="Kommission %"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={formData.commission_percent}
            onChange={(e) => setFormData({ ...formData, commission_percent: e.target.value })}
            required
          />

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
            >
              Annuller
            </Button>
            <Button type="submit" loading={submitting}>
              Opret Sælger
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  )
}

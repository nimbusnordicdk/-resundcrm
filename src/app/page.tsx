import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role === 'admin') {
    redirect('/admin')
  } else if (userData?.role === 'saelger') {
    redirect('/saelger')
  } else if (userData?.role === 'bureau') {
    redirect('/bureau')
  }

  redirect('/login')
}

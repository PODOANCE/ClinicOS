'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { useUser } from '@/lib/contexts/UserContext'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading } = useUser()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: DENIM }}>
            ¡Hola{user?.email ? `, ${user.email.split('@')[0]}` : ''}! 👋
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Bienvenido de nuevo a ClinicOS</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: PUMPKIN }}
        >
          Cerrar sesión
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3
          className="font-semibold px-3 py-2 rounded-lg -mt-2 -mx-2 mb-4 inline-block"
          style={{ backgroundColor: '#f4f7fb', color: DENIM }}
        >
          Sesión activa
        </h3>
        <dl className="grid gap-3 text-sm">
          <div className="flex gap-4">
            <dt className="font-semibold text-gray-600 min-w-[80px]">Email</dt>
            <dd className="text-gray-800">{user?.email}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="font-semibold text-gray-600 min-w-[80px]">ID</dt>
            <dd className="text-xs text-gray-500">{user?.id}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

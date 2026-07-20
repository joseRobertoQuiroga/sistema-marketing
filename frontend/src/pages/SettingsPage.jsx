import { useAuthStore } from '../stores/authStore'
import { useNavigate } from 'react-router-dom'
import { User, Shield, CreditCard, LogOut } from 'lucide-react'

export default function SettingsPage() {
  const { user, org, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex-1 flex flex-col bg-[#051424] overflow-y-auto">
      <div className="p-8 border-b border-slate-800">
        <h2 className="text-2xl font-bold text-white font-display">Configuración</h2>
        <p className="text-slate-400 text-sm mt-1">Gestiona tu cuenta y organización</p>
      </div>

      <div className="p-8 max-w-2xl space-y-8">
        <section>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <User className="w-4 h-4" /> Perfil
          </h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center text-lg font-bold text-indigo-400">
                {user?.name?.charAt(0) || '?'}
              </div>
              <div>
                <h4 className="text-white font-bold">{user?.name}</h4>
                <p className="text-slate-400 text-sm">{user?.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rol</label>
                <p className="text-white text-sm font-bold capitalize">{user?.role || '—'}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Plan</label>
                <p className="text-white text-sm font-bold uppercase">{org?.plan || 'Free'}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Organización</label>
                <p className="text-white text-sm font-bold">{org?.name || '—'}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trial hasta</label>
                <p className="text-white text-sm font-bold">{org?.trialEndsAt ? new Date(org.trialEndsAt).toLocaleDateString() : '—'}</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Plan
          </h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-bold">Plan {org?.plan || 'Free'}</h4>
                <p className="text-slate-400 text-sm">
                  {org?.plan === 'free' ? '500 mensajes/mes · 1 plataforma' : 'Plan activo'}
                </p>
              </div>
              <button onClick={() => navigate('/plans')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all">
                {org?.plan === 'free' ? 'Actualizar' : 'Gestionar'}
              </button>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Seguridad
          </h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <button onClick={handleLogout}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-bold transition-all">
              <LogOut className="w-4 h-4" /> Cerrar Sesión
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

import { BarChart3 as Monitoring, Play as PermMedia, Bot as SmartToy, LineChart as Leaderboard, Megaphone, Sparkles, Activity, Settings, HelpCircle as Help, LogOut as Logout } from 'lucide-react'
import NavItem from '../shared/NavItem'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const org = useAuthStore((s) => s.org)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const isActive = (path) => location.pathname === path

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col pt-4 pb-8 fixed h-[calc(100vh-64px)] overflow-y-auto">
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <span className="text-lg font-bold">{(org?.name || 'AC')[0]}</span>
          </div>
          <div>
            <h3 className="text-white font-bold text-sm truncate max-w-[140px]">{org?.name || 'Mi Empresa'}</h3>
            <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest">
              {user?.role === 'owner' ? 'Admin Account' : user?.role || 'Usuario'}
            </p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1">
        <NavItem icon={<Monitoring />} label="Analytics Hub" active={isActive('/analytics')} onClick={() => navigate('/analytics')} />
        <NavItem icon={<PermMedia />} label="Content Hub" active={isActive('/content')} onClick={() => navigate('/content')} />
        <NavItem icon={<SmartToy />} label="AI Bot Engine" active={isActive('/') || isActive('/bot')} onClick={() => navigate('/')} />
        <NavItem icon={<Leaderboard />} label="Lead Engine" active={isActive('/leads')} onClick={() => navigate('/leads')} />
        <NavItem icon={<Megaphone />} label="Campañas" active={isActive('/campaigns')} onClick={() => navigate('/campaigns')} />
        <NavItem icon={<Sparkles />} label="Lumi IA" active={isActive('/lumi')} onClick={() => navigate('/lumi')} />
        <NavItem icon={<Activity />} label="Monitoreo" active={isActive('/monitoring')} onClick={() => navigate('/monitoring')} />
      </nav>
      <div className="px-6 mt-auto">
        <button onClick={() => navigate('/plans')} className="w-full bg-slate-800 hover:bg-indigo-500 text-white py-3 rounded text-[10px] font-black uppercase tracking-[0.2em] transition-all mb-6">
          Upgrade Plan
        </button>
        <div className="space-y-1">
          <div onClick={() => navigate('/settings')} className="text-slate-500 flex items-center px-2 py-2 hover:text-indigo-300 transition-colors text-xs font-bold uppercase tracking-widest cursor-pointer">
            <Settings className="w-4 h-4 mr-3" /> Settings
          </div>
          <div className="text-slate-500 flex items-center px-2 py-2 hover:text-indigo-300 transition-colors text-xs font-bold uppercase tracking-widest cursor-pointer">
            <Help className="w-4 h-4 mr-3" /> Help Center
          </div>
          <div
            onClick={handleLogout}
            className="text-slate-500 flex items-center px-2 py-2 hover:text-red-400 transition-colors text-xs font-bold uppercase tracking-widest cursor-pointer"
          >
            <Logout className="w-4 h-4 mr-3" /> Log Out
          </div>
        </div>
      </div>
    </aside>
  )
}

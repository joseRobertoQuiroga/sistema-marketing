import { Search, Bell as Notifications, Settings } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'

export default function Header() {
  const user = useAuthStore((s) => s.user)

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'RQ'

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between px-8 fixed w-full top-0 z-50">
      <div className="flex items-center gap-8">
        <span className="text-xl font-black tracking-tighter text-white uppercase font-display">OmniPresence Suite</span>
        <div className="relative flex items-center bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-lg group focus-within:border-indigo-500 transition-all">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            className="bg-transparent border-none focus:ring-0 text-xs w-64 placeholder:text-slate-500 text-white"
            placeholder="Search conversations..."
          />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-slate-400">
          <span className="text-xs font-bold uppercase tracking-widest hover:text-slate-200 cursor-pointer">Live Dashboard</span>
          <Notifications className="w-5 h-5 hover:text-white cursor-pointer" />
          <Settings className="w-5 h-5 hover:text-white cursor-pointer" />
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-indigo-500/20">
          New Lead
        </button>
        <div className="w-8 h-8 rounded-full border border-slate-700 bg-indigo-500/20 flex items-center justify-center text-xs font-bold">
          {initials}
        </div>
      </div>
    </header>
  )
}

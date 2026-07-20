import { Megaphone, Clock, CheckCircle2, XCircle, Send, BarChart3, Plus, Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import CampaignCard from '../components/campaign/CampaignCard'

const STATUS_ICONS = {
  draft: <Clock className="w-4 h-4 text-slate-400" />,
  scheduled: <Clock className="w-4 h-4 text-blue-400" />,
  sending: <Send className="w-4 h-4 text-yellow-400" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  cancelled: <XCircle className="w-4 h-4 text-red-400" />,
  failed: <XCircle className="w-4 h-4 text-orange-400" />,
}

export default function CampaignsPage() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const [campaigns, setCampaigns] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const fetchCampaigns = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/campaigns?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data)
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/campaigns/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setStats(data.global)
      }
    } catch (err) {
      console.error('Error fetching campaign stats:', err)
    }
  }

  useEffect(() => {
    Promise.all([fetchCampaigns(), fetchStats()]).finally(() => setLoading(false))
  }, [statusFilter])

  const filtered = campaigns.filter(c =>
    !searchTerm || c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Megaphone className="w-6 h-6 text-indigo-400" />
              Campañas
            </h1>
            <p className="text-slate-400 text-sm mt-1">Gestiona y lanza campañas de mensajes masivos</p>
          </div>
          <button
            onClick={() => navigate('/campaigns/new')}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva Campaña
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Total</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Enviados</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{stats.total_sent}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Entregados</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{stats.total_delivered}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Leídos</p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">{stats.total_read}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Respondidos</p>
              <p className="text-2xl font-bold text-purple-400 mt-1">{stats.total_replied}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar campañas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="flex gap-2">
            {['', 'draft', 'scheduled', 'sending', 'completed'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                  statusFilter === s
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:text-white border border-slate-700/50'
                }`}
              >
                {STATUS_ICONS[s] && <span className="inline-block mr-1.5 align-middle">{STATUS_ICONS[s]}</span>}
                {s || 'Todas'}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No hay campañas aún</p>
            <p className="text-sm mt-1">Crea tu primera campaña para empezar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onClick={() => navigate(`/campaigns/${campaign.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

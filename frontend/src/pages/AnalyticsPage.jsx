import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../services/apiClient'
import { BarChart3, Users, Heart, MessageCircle, Share2, Eye, PlusCircle, Camera, Globe } from 'lucide-react'

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    client.get('/api/analytics/overview')
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleConnectMeta = async () => {
    try {
      const { data } = await client.get('/api/analytics/meta/connect')
      window.open(data.url, '_blank', 'width=600,height=700')
    } catch (err) {
      console.error('Error connecting Meta', err)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#051424]">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const metrics = data?.metrics || {}
  const connections = data?.connections || []
  const trend = data?.trend || []

  const kpiCards = [
    { label: 'Followers', value: metrics.total_followers || 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Likes', value: metrics.total_likes || 0, icon: Heart, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Comments', value: metrics.total_comments || 0, icon: MessageCircle, color: 'text-secondary', bg: 'bg-secondary/10' },
    { label: 'Shares', value: metrics.total_shares || 0, icon: Share2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Views', value: metrics.total_views || 0, icon: Eye, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Engagement', value: `${(parseFloat(metrics.avg_engagement) || 0).toFixed(2)}%`, icon: BarChart3, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  ]

  return (
    <div className="flex-1 flex flex-col bg-[#051424] overflow-y-auto">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white font-display">Analytics Hub</h2>
          <p className="text-slate-400 text-sm">Métricas de redes sociales y rendimiento</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleConnectMeta}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
          >
            <Camera className="w-4 h-4" /> Conectar Instagram
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-6 gap-4 mb-8">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className={`${kpi.bg} border border-slate-800 rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <span className="text-2xl font-black text-white font-display">{kpi.value}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-bold text-white mb-4 font-display">Tendencia (últimos 30 días)</h3>
            {trend.length > 0 ? (
              <div className="h-64 flex items-end gap-2">
                {trend.map((t, i) => {
                  const max = Math.max(...trend.map((x) => parseInt(x.followers) || 0), 1)
                  const height = ((parseInt(t.followers) || 0) / max) * 100
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-indigo-500 rounded-t hover:bg-indigo-400 transition-all cursor-pointer"
                        style={{ height: `${Math.max(height, 2)}%` }}
                        title={`${t.metric_date}: ${t.followers} followers`}
                      />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-600 text-sm">
                Conecta una red social para ver tendencias
              </div>
            )}
          </div>

          <div className="col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-bold text-white mb-4 font-display">Cuentas Conectadas</h3>
            {connections.length > 0 ? (
              <div className="space-y-3">
                {connections.map((conn) => (
                  <div key={conn.id} className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${conn.platform === 'instagram' ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-blue-600'}`}>
                      {conn.platform === 'instagram' ? <Camera className="w-4 h-4 text-white" /> : <Globe className="w-4 h-4 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{conn.platform_account_name || conn.platform}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{conn.platform}</p>
                    </div>
                    <span className={`w-2 h-2 rounded-full ${conn.is_active ? 'bg-secondary' : 'bg-slate-600'}`} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <PlusCircle className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-xs text-slate-500">Conecta Instagram o Facebook para empezar</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

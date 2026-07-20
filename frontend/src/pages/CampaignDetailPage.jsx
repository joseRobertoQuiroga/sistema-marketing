import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Clock, XCircle, BarChart3, CheckCircle2, Loader } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'

const STATUS_BADGES = {
  draft: { label: 'Borrador', class: 'bg-slate-700 text-slate-300' },
  scheduled: { label: 'Programada', class: 'bg-blue-900/50 text-blue-300' },
  sending: { label: 'Enviando', class: 'bg-yellow-900/50 text-yellow-300' },
  completed: { label: 'Completada', class: 'bg-green-900/50 text-green-300' },
  cancelled: { label: 'Cancelada', class: 'bg-red-900/50 text-red-300' },
  failed: { label: 'Fallida', class: 'bg-orange-900/50 text-orange-300' },
}

export default function CampaignDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchDetail = async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDetail() }, [id])

  const handleAction = async (action) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        await fetchDetail()
      } else {
        const errData = await res.json()
        setError(errData.error || `Error al ${action}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data || !data.campaign) {
    return (
      <div className="flex-1 p-8 text-center text-slate-500">
        <p className="text-lg">Campaña no encontrada</p>
        <button onClick={() => navigate('/campaigns')} className="text-indigo-400 mt-4 hover:underline">
          Volver a campañas
        </button>
      </div>
    )
  }

  const { campaign, messages } = data
  const badge = STATUS_BADGES[campaign.status] || STATUS_BADGES.draft
  const progress = campaign.stats?.total > 0
    ? Math.round((campaign.stats.sent / campaign.stats.total) * 100)
    : 0

  const statusCounts = {}
  if (messages) {
    messages.forEach((m) => {
      statusCounts[m.status] = (statusCounts[m.status] || 0) + 1
    })
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/campaigns')}
          className="text-slate-400 hover:text-white flex items-center gap-2 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a campañas
        </button>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 mb-6 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
              <span className={`inline-block mt-2 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded ${badge.class}`}>
                {badge.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {campaign.isDraft && (
                <>
                  <button
                    onClick={() => handleAction('schedule')}
                    disabled={actionLoading}
                    className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors"
                  >
                    <Clock className="w-3 h-3" /> Programar
                  </button>
                  <button
                    onClick={() => handleAction('send')}
                    disabled={actionLoading}
                    className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors"
                  >
                    <Send className="w-3 h-3" /> Enviar ahora
                  </button>
                </>
              )}
              {(campaign.isScheduled || campaign.isSending) && (
                <button
                  onClick={() => handleAction('cancel')}
                  disabled={actionLoading}
                  className="bg-red-500/80 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors"
                >
                  <XCircle className="w-3 h-3" /> Cancelar
                </button>
              )}
              {actionLoading && <Loader className="w-4 h-4 text-indigo-400 animate-spin" />}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block text-xs uppercase tracking-wider">Plataforma</span>
              <span className="text-white font-medium">{campaign.platform}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs uppercase tracking-wider">Creada</span>
              <span className="text-white font-medium">{new Date(campaign.createdAt).toLocaleDateString()}</span>
            </div>
            {campaign.scheduledAt && (
              <div>
                <span className="text-slate-500 block text-xs uppercase tracking-wider">Programada</span>
                <span className="text-white font-medium">{new Date(campaign.scheduledAt).toLocaleString()}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500 block text-xs uppercase tracking-wider">Contactos</span>
              <span className="text-white font-medium">{campaign.stats?.total || 0}</span>
            </div>
          </div>

          {campaign.stats?.total > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-400">Progreso de envío</span>
                <span className="text-white font-medium">{progress}%</span>
              </div>
              <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="grid grid-cols-5 gap-3 mt-4">
                {[
                  { label: 'Enviados', value: campaign.stats.sent, color: 'text-green-400' },
                  { label: 'Entregados', value: campaign.stats.delivered, color: 'text-blue-400' },
                  { label: 'Leídos', value: campaign.stats.read, color: 'text-indigo-400' },
                  { label: 'Respondidos', value: campaign.stats.replied, color: 'text-purple-400' },
                  { label: 'Fallidos', value: campaign.stats.failed, color: 'text-red-400' },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {messages && messages.length > 0 && (
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Mensajes ({messages.length})
            </h2>

            {Object.keys(statusCounts).length > 0 && (
              <div className="flex gap-3 mb-4 text-xs">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <span key={status} className="bg-slate-700/30 text-slate-400 px-2.5 py-1 rounded-full">
                    {status}: {count}
                  </span>
                ))}
              </div>
            )}

            <div className="max-h-96 overflow-y-auto space-y-1">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-700/20 transition-colors text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-slate-400 truncate max-w-[200px]">{msg.platform_conversation_id}</span>
                    <span className="text-slate-500 text-xs">{msg.platform}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${
                      msg.status === 'sent' ? 'text-green-400' :
                      msg.status === 'delivered' ? 'text-blue-400' :
                      msg.status === 'read' ? 'text-indigo-400' :
                      msg.status === 'replied' ? 'text-purple-400' :
                      msg.status === 'failed' ? 'text-red-400' : 'text-slate-500'
                    }`}>
                      {msg.status}
                    </span>
                    {msg.sent_at && <span className="text-slate-600 text-xs">{new Date(msg.sent_at).toLocaleTimeString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {campaign.audienceFilter && Object.keys(campaign.audienceFilter).length > 0 && (
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-6 mt-6">
            <h2 className="text-white font-semibold mb-3">Filtro de Audiencia</h2>
            <pre className="text-xs text-slate-400 bg-slate-900/50 rounded-lg p-3 overflow-x-auto">
              {JSON.stringify(campaign.audienceFilter, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

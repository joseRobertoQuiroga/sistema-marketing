import { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/authStore'
import {
  Activity, Database, Cpu, BarChart3, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, MessageSquare, Users, Package, Megaphone, Layers, Clock, Zap
} from 'lucide-react'

export default function MonitoringPage() {
  const token = useAuthStore((s) => s.token)
  const [data, setData] = useState(null)
  const [dbHealth, setDbHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchData = async () => {
    try {
      const [overviewRes, dbRes] = await Promise.all([
        fetch('/api/monitoring/overview', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/monitoring/db', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (overviewRes.ok) {
        const d = await overviewRes.json()
        setData(d)
      }
      if (dbRes.ok) {
        const d = await dbRes.json()
        setDbHealth(d)
      }
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      console.error('Error fetching monitoring data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    if (autoRefresh) {
      const interval = setInterval(fetchData, 15000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const StatusBadge = ({ status }) => {
    if (status === 'ok') return <span className="flex items-center gap-1 text-green-400 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> OK</span>
    if (status === 'inactive') return <span className="flex items-center gap-1 text-slate-500 text-xs font-medium"><XCircle className="w-3 h-3" /> Inactivo</span>
    return <span className="flex items-center gap-1 text-yellow-400 text-xs font-medium"><AlertTriangle className="w-3 h-3" /> {status}</span>
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  const modules = data?.modules || {}
  const entities = data?.entities || {}
  const campaigns = data?.campaigns || {}
  const activity = data?.activity || []
  const memory = data?.memory || {}

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Activity className="w-6 h-6 text-indigo-400" />
              Monitoreo del Sistema
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Estado en tiempo real de módulos, procesos y entidades
              {lastUpdated && <span className="ml-2 text-slate-500">· actualizado {lastUpdated}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-indigo-500"
              />
              Auto-refresh (15s)
            </label>
            <button
              onClick={fetchData}
              className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* System Uptime & Memory */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider mb-2">
              <Zap className="w-3.5 h-3.5" /> Uptime
            </div>
            <p className="text-xl font-bold text-white">{Math.floor(data?.uptime / 3600)}h {Math.floor((data?.uptime % 3600) / 60)}m</p>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider mb-2">
              <Cpu className="w-3.5 h-3.5" /> Memoria RSS
            </div>
            <p className="text-xl font-bold text-white">{Math.round((memory?.rss || 0) / 1024 / 1024)} MB</p>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider mb-2">
              <Cpu className="w-3.5 h-3.5" /> Heap Used
            </div>
            <p className="text-xl font-bold text-white">{Math.round((memory?.heapUsed || 0) / 1024 / 1024)} MB</p>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider mb-2">
              <Database className="w-3.5 h-3.5" /> DB Size
            </div>
            <p className="text-xl font-bold text-white">{dbHealth?.sizeMb || '—'} MB</p>
          </div>
        </div>

        {/* Module Status */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Chatbot Module */}
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" /> Chatbot
              </h3>
              <StatusBadge status={modules.chatbot?.status} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Plataformas</span>
                <span className="text-white">{modules.chatbot?.platforms?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">AI Providers</span>
                <span className="text-white">{modules.chatbot?.aiProviders?.availableProviders?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Conversaciones DB</span>
                <span className="text-white">{modules.chatbot?.conversations || '—'}</span>
              </div>
              {modules.chatbot?.aiProviders?.availableProviders?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {modules.chatbot.aiProviders.availableProviders.map((p) => (
                    <span key={p} className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full">{p}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lumi Module */}
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" /> Lumi IA
              </h3>
              <StatusBadge status={modules.lumi?.status} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Context Builder</span>
                <span className="text-white">{modules.lumi?.contextBuilder === 'connected' ? '✅' : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Orquestador</span>
                <span className="text-white">{modules.lumi?.orchestrator ? '✅' : '—'}</span>
              </div>
              <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-xs text-slate-500">Consultas NL sobre ventas, productos, leads y campañas. Generación de descripciones SEO. Carga masiva de productos.</p>
              </div>
            </div>
          </div>

          {/* Campaigns Module */}
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-green-400" /> Campañas
              </h3>
              <StatusBadge status={modules.campaigns?.status} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Scheduler</span>
                <span className="text-white">{modules.campaigns?.schedulerRunning ? '✅ Activo' : '⏹ Detenido'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Completadas</span>
                <span className="text-white">{campaigns.completed || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Activas/Programadas</span>
                <span className="text-white">{(campaigns.sending || 0) + (campaigns.scheduled || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total enviados</span>
                <span className="text-white">{campaigns.total_sent || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Entity Counts */}
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-6 mb-8">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" /> Entidades del Sistema
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {[
              { label: 'Productos', value: entities.products, icon: Package, color: 'text-blue-400' },
              { label: 'Activos', value: entities.active_products, icon: Package, color: 'text-green-400' },
              { label: 'Leads', value: entities.leads, icon: Users, color: 'text-purple-400' },
              { label: 'Conversaciones', value: entities.conversations, icon: MessageSquare, color: 'text-indigo-400' },
              { label: 'Activas', value: entities.active_conversations, icon: MessageSquare, color: 'text-green-400' },
              { label: 'Mensajes', value: entities.messages, icon: MessageSquare, color: 'text-amber-400' },
              { label: 'Users Msgs', value: entities.user_messages, icon: MessageSquare, color: 'text-cyan-400' },
              { label: 'Campañas', value: entities.campaigns, icon: Megaphone, color: 'text-rose-400' },
            ].map((item) => (
              <div key={item.label} className="bg-slate-900/50 rounded-lg p-3 text-center">
                <item.icon className={`w-4 h-4 mx-auto mb-1 ${item.color}`} />
                <p className="text-lg font-bold text-white">{item.value ?? '—'}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Campaign Status Breakdown */}
        {campaigns.total > 0 && (
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-6 mb-8">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" /> Estado de Campañas
            </h2>
            <div className="flex gap-4">
              {[
                { label: 'Borradores', value: campaigns.draft, color: 'bg-slate-500' },
                { label: 'Programadas', value: campaigns.scheduled, color: 'bg-blue-500' },
                { label: 'Enviando', value: campaigns.sending, color: 'bg-yellow-500' },
                { label: 'Completadas', value: campaigns.completed, color: 'bg-green-500' },
                { label: 'Fallidas', value: campaigns.failed, color: 'bg-red-500' },
              ].map((item) => (
                <div key={item.label} className="flex-1">
                  <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${campaigns.total > 0 ? (item.value / campaigns.total) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1 text-center">{item.label}: <span className="text-white font-medium">{item.value}</span></p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Database Health */}
        {dbHealth && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" /> Base de Datos
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Estado</span>
                  <StatusBadge status={dbHealth.status} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Latencia</span>
                  <span className="text-white font-mono">{dbHealth.latencyMs}ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Tamaño</span>
                  <span className="text-white font-mono">{dbHealth.sizeMb} MB</span>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Tablas</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {(dbHealth.tables || []).map((t) => (
                      <div key={t.tablename} className="flex justify-between text-xs text-slate-400">
                        <span>{t.tablename}</span>
                        <span className="text-white font-mono">{t.row_count} rows</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" /> Actividad Reciente
              </h2>
              {activity.length === 0 ? (
                <p className="text-slate-500 text-sm">Sin actividad reciente</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {activity.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-700/20 last:border-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.type === 'message' ? 'bg-indigo-400' : 'bg-green-400'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-300 truncate">{item.summary}</p>
                        <p className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleString()}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        item.type === 'message' ? 'bg-indigo-500/10 text-indigo-300' : 'bg-green-500/10 text-green-300'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

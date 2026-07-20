import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Clock, Eye, Users } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'

export default function CampaignCreatePage() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

  const [form, setForm] = useState({
    name: '',
    platform: 'all',
    templateId: '',
    audienceFilter: '{}',
    scheduledAt: '',
    sendNow: true,
  })

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleAudiencePreview = async () => {
    try {
      let filter = {}
      try { filter = JSON.parse(form.audienceFilter || '{}') } catch {}
      const res = await fetch('/api/campaigns/audience-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audienceFilter: filter }),
      })
      if (res.ok) {
        const data = await res.json()
        setPreview(data)
      }
    } catch (err) {
      console.error('Error previewing audience:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      let filter = {}
      try { filter = JSON.parse(form.audienceFilter || '{}') } catch {}

      const payload = {
        name: form.name,
        platform: form.platform,
        templateId: form.templateId || undefined,
        audienceFilter: filter,
        scheduledAt: form.sendNow ? undefined : (form.scheduledAt || undefined),
      }

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al crear campaña')
      }

      const campaign = await res.json()

      if (form.sendNow) {
        await fetch(`/api/campaigns/${campaign.id}/send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      } else if (form.scheduledAt) {
        await fetch(`/api/campaigns/${campaign.id}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ scheduledAt: form.scheduledAt }),
        })
      }

      navigate('/campaigns')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/campaigns')}
          className="text-slate-400 hover:text-white flex items-center gap-2 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a campañas
        </button>

        <h1 className="text-2xl font-bold text-white mb-8">Nueva Campaña</h1>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 mb-6 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Save className="w-4 h-4 text-indigo-400" />
              Información Básica
            </h2>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5 font-medium">Nombre de la campaña *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                placeholder="Ej: Oferta de Verano 2026"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5 font-medium">Plataforma</label>
              <select
                value={form.platform}
                onChange={(e) => updateField('platform', e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50"
              >
                <option value="all">Todas las plataformas</option>
                <option value="telegram">Telegram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="messenger">Messenger</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5 font-medium">Mensaje / Plantilla ID</label>
              <textarea
                value={form.templateId}
                onChange={(e) => updateField('templateId', e.target.value)}
                rows={3}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 resize-none"
                placeholder="¡Hola! Aprovecha nuestra oferta especial..."
              />
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Segmentación de Audiencia
            </h2>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5 font-medium">Filtro JSON</label>
              <textarea
                value={form.audienceFilter}
                onChange={(e) => updateField('audienceFilter', e.target.value)}
                rows={4}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 resize-none font-mono text-xs"
                placeholder='{"status": "new", "minScore": 50, "productInterest": "vestido"}'
              />
              <p className="text-xs text-slate-500 mt-1">
                Filtros disponibles: status, minScore, productInterest, platform, dateFrom, dateTo
              </p>
            </div>

            <button
              type="button"
              onClick={handleAudiencePreview}
              className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-2 transition-colors"
            >
              <Eye className="w-4 h-4" />
              Previsualizar audiencia
            </button>

            {preview && (
              <div className="bg-slate-900/50 rounded-lg p-4 text-sm">
                <p className="text-green-400 font-medium mb-2">
                  Audiencia estimada: <span className="text-white">{preview.total}</span> contactos
                </p>
                {preview.preview?.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {preview.preview.map((lead, i) => (
                      <div key={i} className="text-slate-400 text-xs flex items-center gap-2">
                        <span className="w-2 h-2 bg-indigo-400/50 rounded-full" />
                        {lead.nombre || 'Usuario'} — {lead.platform || lead.fuente || 'desconocida'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Programación
            </h2>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.sendNow}
                onChange={(e) => updateField('sendNow', e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50"
              />
              <div>
                <span className="text-white text-sm">Enviar ahora</span>
                <p className="text-xs text-slate-500">La campaña se enviará inmediatamente después de crearla</p>
              </div>
            </label>

            {!form.sendNow && (
              <div>
                <label className="block text-sm text-slate-400 mb-1.5 font-medium">Programar para</label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => updateField('scheduledAt', e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || !form.name.trim()}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {form.sendNow ? 'Crear y Enviar' : form.scheduledAt ? 'Crear y Programar' : 'Guardar Borrador'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/campaigns')}
              className="text-slate-400 hover:text-white px-4 py-2.5 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

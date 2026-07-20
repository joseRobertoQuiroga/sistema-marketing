import { useNavigate } from 'react-router-dom'
import { Megaphone, Clock, Send, CheckCircle2, XCircle, BarChart3 } from 'lucide-react'

const STATUS_BADGES = {
  draft: { label: 'Borrador', class: 'bg-slate-700 text-slate-300' },
  scheduled: { label: 'Programada', class: 'bg-blue-900/50 text-blue-300' },
  sending: { label: 'Enviando', class: 'bg-yellow-900/50 text-yellow-300' },
  completed: { label: 'Completada', class: 'bg-green-900/50 text-green-300' },
  cancelled: { label: 'Cancelada', class: 'bg-red-900/50 text-red-300' },
  failed: { label: 'Fallida', class: 'bg-orange-900/50 text-orange-300' },
}

const PLATFORM_LABELS = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  tiktok: 'TikTok',
  all: 'Multiplataforma',
}

export default function CampaignCard({ campaign, onClick }) {
  const badge = STATUS_BADGES[campaign.status] || STATUS_BADGES.draft
  const progress = campaign.stats?.total > 0
    ? Math.round((campaign.stats.sent / campaign.stats.total) * 100)
    : 0

  return (
    <div
      onClick={onClick}
      className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5 hover:border-indigo-500/30 hover:bg-slate-800/50 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-indigo-400" />
          <h3 className="text-white font-semibold truncate max-w-[180px]">{campaign.name}</h3>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${badge.class}`}>
          {badge.label}
        </span>
      </div>

      <div className="space-y-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-500">Plataforma:</span>
          <span>{PLATFORM_LABELS[campaign.platform] || campaign.platform}</span>
        </div>
        {campaign.scheduledAt && (
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span>{new Date(campaign.scheduledAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      {campaign.stats && campaign.stats.total > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500">Progreso</span>
            <span className="text-slate-400">{progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><Send className="w-3 h-3" /> {campaign.stats.sent}</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {campaign.stats.delivered}</span>
            <span className="flex items-center gap-1"><XCircle className="w-3 h-3" /> {campaign.stats.failed}</span>
          </div>
        </div>
      )}

      {campaign.audienceFilter && Object.keys(campaign.audienceFilter).length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/30">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(campaign.audienceFilter).map(([key, val]) => (
              <span key={key} className="text-[10px] bg-slate-700/30 text-slate-400 px-2 py-0.5 rounded">
                {key}: {String(val)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

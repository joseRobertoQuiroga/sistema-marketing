import DataField from '../shared/DataField'
import { Sparkles as AutoAwesome } from 'lucide-react'

export default function IntelPanel({ thread }) {
  if (!thread) return null

  return (
    <section className="w-80 bg-[#0d1c2d] border-l border-slate-800 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Intent Score</h4>
        <div className="flex items-end justify-between mb-2">
          <span className="text-4xl font-bold text-secondary font-display">{thread.score || 0}</span>
          <span className="text-[10px] text-secondary font-bold uppercase mb-1">Dynamic Rating</span>
        </div>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div className="bg-secondary h-full rounded-full shadow-[0_0_15px_#4edea3]" style={{ width: `${thread.score || 0}%` }}></div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Captured Data</h4>
        <DataField label="Lead Status" value={thread.status || 'Consultas'} info />
        <DataField label="Location" value={thread.captured_data?.localidad || 'Pendiente'} />
        <DataField label="Interests" value={thread.captured_data?.intereses || 'Pendiente'} />
        <DataField label="Platform ID" value={thread.id?.slice(0, 10) + '...'} verified />
      </div>

      <div className="mt-auto pt-6">
        <div className="p-4 glass-surface rounded-xl border border-indigo-500/20 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <AutoAwesome className="w-4 h-4 text-indigo-400" />
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Bot Insight</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed italic">
            {thread.status === 'Conversión'
              ? 'Alta intención de compra detectada. Recomiendo intervención humana.'
              : thread.status === 'Interés'
              ? 'El lead está explorando productos o servicios.'
              : 'Consultas generales, interactuando de forma amigable.'}
          </p>
        </div>
      </div>
    </section>
  )
}

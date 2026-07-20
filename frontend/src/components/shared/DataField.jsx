import { CheckCircle2 as Verified, Clock as Pending, Info } from 'lucide-react'

export default function DataField({ label, value, verified, pending, info }) {
  return (
    <div className="flex flex-col gap-1 p-3 bg-slate-900/50 rounded border border-slate-800/50 hover:border-slate-700 transition-colors">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-mono ${pending ? 'text-slate-400 italic' : 'text-white'}`}>{value}</span>
        {verified && <Verified className="w-3.5 h-3.5 text-secondary" />}
        {pending && <Pending className="w-3.5 h-3.5 text-slate-600" />}
        {info && <Info className="w-3.5 h-3.5 text-indigo-400" />}
      </div>
    </div>
  )
}

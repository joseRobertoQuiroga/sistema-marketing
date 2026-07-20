import { Bot as SmartToy, Building2 as CorporateFare } from 'lucide-react'

export default function Message({ type, content, time }) {
  const isSelf = type === 'user'
  const isAdmin = type === 'admin'
  return (
    <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className="max-w-[80%]">
        <div className={`p-4 rounded-xl text-sm shadow-md
          ${isSelf ? 'bg-indigo-600 text-white rounded-tr-none' :
            isAdmin ? 'glass-surface border border-emerald-500/30 text-emerald-100 rounded-tl-none' :
            'glass-surface border border-indigo-500/20 text-white rounded-tl-none'}
        `}>
          {type === 'bot' && (
            <div className="flex items-center gap-2 mb-2">
              <SmartToy className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">OMNI BOT</span>
            </div>
          )}
          {isAdmin && (
            <div className="flex items-center gap-2 mb-2">
              <CorporateFare className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">AGENT (YOU)</span>
            </div>
          )}
          {content}
        </div>
        <p className={`text-[10px] text-slate-500 font-mono mt-1 ${isSelf ? 'text-right' : 'text-left'}`}>
          {time} • {isSelf ? 'User' : isAdmin ? 'Agent' : 'AI Generated'}
        </p>
      </div>
    </div>
  )
}

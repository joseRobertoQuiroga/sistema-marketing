export default function ThreadList({ threads, activeThread, onSelect }) {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {threads.map(thread => (
        <div
          key={thread.id}
          onClick={() => onSelect(thread)}
          className={`p-4 border-b border-slate-800 cursor-pointer transition-all relative group
            ${activeThread?.id === thread.id ? 'bg-indigo-500/10' : 'hover:bg-slate-800/30'}
          `}
        >
          {activeThread?.id === thread.id && (
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
          )}
          <div className="flex justify-between items-start mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-widest
              ${thread.status === 'Conversión' ? 'text-secondary' : thread.status === 'Interés' ? 'text-tertiary' : 'text-slate-500'}
            `}>{thread.status || 'Consultas'}</span>
            <span className="text-[10px] text-slate-500 font-mono">{thread.time}</span>
          </div>
          <h4 className="text-sm font-semibold text-white mb-1 font-display">{thread.name}</h4>
          <p className="text-slate-400 text-xs truncate">{thread.lastMsg}</p>
        </div>
      ))}
    </div>
  )
}

import { Send, PlusCircle as AddCircle } from 'lucide-react'

export default function ChatInput({ value, onChange, onSend }) {
  return (
    <div className="p-4 glass-surface border-t border-slate-800">
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-2 focus-within:border-indigo-500 transition-colors shadow-inner">
        <button className="p-2 text-slate-500 hover:text-white transition-colors">
          <AddCircle className="w-5 h-5" />
        </button>
        <input
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white placeholder:text-slate-600"
          placeholder="Type a message or use '/' for AI commands..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
        />
        <button
          onClick={onSend}
          className="bg-indigo-500 text-white p-2 rounded-lg hover:bg-indigo-400 transition-all active:scale-95 shadow-lg shadow-indigo-500/40"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

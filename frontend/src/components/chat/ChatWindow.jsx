import { useState } from 'react'
import { Hand as FrontHand } from 'lucide-react'
import Message from './Message'
import ChatInput from './ChatInput'
import client from '../../services/apiClient'

export default function ChatWindow({ thread, messages, onMessageSent }) {
  const [replyText, setReplyText] = useState('')
  const [isBotPaused, setIsBotPaused] = useState(false)

  const handleSend = async () => {
    if (!replyText.trim() || !thread) return
    const textToSend = replyText
    setReplyText('')
    try {
      await client.post(`/api/conversations/${thread.id}/reply`, { text: textToSend, platform: 'telegram' })
      setIsBotPaused(true)
    } catch (err) {
      console.error('Error sending message', err)
    }
  }

  const handleTakeControl = async () => {
    if (!thread) return
    try {
      await client.post(`/api/conversations/${thread.id}/take-control`)
      setIsBotPaused(true)
    } catch (err) {
      console.error('Error taking control', err)
    }
  }

  return (
    <section className="flex-1 flex flex-col bg-slate-900/20 relative overflow-hidden">
      <header className="p-4 border-b border-slate-800 flex items-center justify-between glass-surface z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-indigo-400 border border-slate-700">
            {thread?.avatar || '?'}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white font-display">{thread?.name || 'Usuario'}</h3>
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isBotPaused ? 'bg-amber-500' : 'bg-secondary'}`}></span>
              {isBotPaused ? 'Manual Override' : 'AI Bot Active'}
            </p>
          </div>
        </div>
        <button
          onClick={handleTakeControl}
          disabled={isBotPaused}
          className={`px-4 py-2 rounded flex items-center gap-2 text-xs font-bold transition-all shadow-lg active:scale-95 ${isBotPaused ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/20'}`}
        >
          <FrontHand className="w-4 h-4" /> Take Control
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-950/30">
        {messages.map((msg, i) => (
          <Message key={i} type={msg.type} content={msg.content} time={msg.time} />
        ))}
      </div>

      <ChatInput value={replyText} onChange={setReplyText} onSend={handleSend} />
    </section>
  )
}

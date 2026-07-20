import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { Sparkles, Send, Bot, User, BarChart3, PenLine, Package, Lightbulb, Loader } from 'lucide-react'

const SUGGESTIONS = [
  { icon: BarChart3, label: '¿Cómo van las ventas?', query: '¿Cómo van las ventas este mes?' },
  { icon: BarChart3, label: 'Productos populares', query: '¿Cuáles son mis productos más populares?' },
  { icon: BarChart3, label: 'Estado de leads', query: '¿Cuántos leads tengo y cómo están distribuidos?' },
  { icon: PenLine, label: 'Generar descripción SEO', query: 'Genera una descripción SEO para un vestido de verano' },
  { icon: Package, label: 'Cargar productos', query: 'Quiero cargar 3 productos: Vestido Rojo Bs.180, Sandalias Bs.120, Cartera Bs.250' },
]

export default function LumiChatPage() {
  const token = useAuthStore((s) => s.token)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy **Lumi**, tu asistente de inteligencia de negocio. Puedo ayudarte a analizar ventas, generar contenido, cargar productos y más. ¿Qué necesitas?', type: 'text' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState(null)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => { scrollToBottom() }, [messages])

  useEffect(() => {
    fetch('/api/lumi/context', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setContext(data))
      .catch(() => {})
  }, [])

  const sendQuery = async (text) => {
    if (!text.trim() || loading) return
    setLoading(true)
    const userMsg = { role: 'user', content: text, type: 'text' }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    try {
      const res = await fetch('/api/lumi/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) throw new Error('Error en la consulta')

      const data = await res.json()
      const botMsg = {
        role: 'assistant',
        content: data.text || 'No entendí tu consulta. ¿Puedes reformularla?',
        type: data.type || 'text',
        data: data.data || null,
        suggestions: data.suggestions || [],
      }
      setMessages((prev) => [...prev, botMsg])
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `⚠️ Ocurrió un error al procesar tu consulta. Por favor intenta de nuevo.`,
        type: 'error',
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendQuery(input)
    }
  }

  const renderMessage = (msg, idx) => {
    const isUser = msg.role === 'user'
    return (
      <div key={idx} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-indigo-500' : 'bg-gradient-to-br from-purple-500 to-indigo-600'
        }`}>
          {isUser ? <User className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
        </div>
        <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
          <div className={`rounded-2xl px-4 py-3 ${
            isUser ? 'bg-indigo-500/20 border border-indigo-500/30' : 'bg-slate-800/50 border border-slate-700/30'
          }`}>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{msg.content}</p>
          </div>
          {!isUser && msg.suggestions?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {msg.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendQuery(s.query)}
                  className="flex items-center gap-1.5 text-xs bg-slate-700/40 hover:bg-slate-700/60 text-slate-300 px-3 py-1.5 rounded-full transition-colors border border-slate-600/30"
                >
                  <Lightbulb className="w-3 h-3 text-yellow-400" />
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-slate-800 px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Lumi
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">IA</span>
            </h1>
            <p className="text-xs text-slate-500">Tu asistente de inteligencia de negocio</p>
          </div>
        </div>
      </div>

      {context && (
        <div className="flex gap-4 px-8 py-3 border-b border-slate-800/50 bg-slate-900/30 overflow-x-auto">
          <div className="flex items-center gap-2 text-xs text-slate-400 flex-shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-white font-medium">{context.products?.summary?.active || 0}</span> productos activos
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 flex-shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-green-400" />
            <span className="text-white font-medium">{context.customers?.summary?.total_leads || 0}</span> leads
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 flex-shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-white font-medium">{context.campaigns?.total || 0}</span> campañas
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {messages.length === 1 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendQuery(s.query)}
                className="bg-slate-800/30 border border-slate-700/30 hover:border-indigo-500/30 rounded-xl p-4 text-left transition-all group"
              >
                <s.icon className="w-5 h-5 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs text-slate-300 font-medium">{s.label}</p>
              </button>
            ))}
          </div>
        )}
        {messages.map(renderMessage)}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-800/50 border border-slate-700/30 rounded-2xl px-4 py-3">
              <Loader className="w-4 h-4 text-indigo-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-800 px-8 py-4 bg-slate-900/50">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregúntale a Lumi..."
            disabled={loading}
            className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
          />
          <button
            onClick={() => sendQuery(input)}
            disabled={!input.trim() || loading}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import { 
  Search, Bell as Notifications, Settings, Building2 as CorporateFare, 
  BarChart3 as Monitoring, Play as PermMedia, Bot as SmartToy, LineChart as Leaderboard, 
  HelpCircle as Help, LogOut as Logout, Hand as FrontHand, Send, PlusCircle as AddCircle, 
  CheckCircle2 as Verified, Clock as Pending, Info, Sparkles as AutoAwesome, ThumbsUp as ThumbUp, RefreshCw as Refresh
} from 'lucide-react'

const API_URL = 'http://localhost:3000'
const socket = io(API_URL)

function App() {
  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [currentScreen, setCurrentScreen] = useState('bot')

  // Cargar hilos iniciales
  useEffect(() => {
    fetchThreads()
    
    socket.on('new_message', (msg) => {
      // Si el mensaje es para la conversación activa, añadirlo
      if (activeThread && msg.conversationId === activeThread.id) {
        setMessages(prev => [...prev, { type: msg.role === 'user' ? 'user' : 'bot', content: msg.content, time: 'Just now' }])
      }
      // Refrescar lista de hilos para ver el último mensaje y score
      fetchThreads()
    })

    return () => socket.off('new_message')
  }, [activeThread])

  const fetchThreads = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/conversations`)
      const data = res.data.rows || res.data;
      setThreads(data)
      if (!activeThread && data.length) {
        setActiveThread(data[0])
      }
    } catch (err) {
      console.error("Error fetching threads", err)
    }
  }

  // Cargar mensajes al cambiar de hilo
  useEffect(() => {
    if (activeThread) {
      fetchMessages(activeThread.id)
    }
  }, [activeThread])

  const fetchMessages = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/api/conversations/${id}/messages`)
      setMessages(res.data.map(m => ({
        type: m.type === 'user' ? 'user' : 'bot',
        content: m.content,
        time: new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })))
    } catch (err) {
      console.error("Error fetching messages", err)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#051424] text-[#d4e4fa] font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between px-8 fixed w-full top-0 z-50">
        <div className="flex items-center gap-8">
          <span className="text-xl font-black tracking-tighter text-white uppercase font-display">OmniPresence Suite</span>
          <div className="relative flex items-center bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-lg group focus-within:border-indigo-500 transition-all">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              className="bg-transparent border-none focus:ring-0 text-xs w-64 placeholder:text-slate-500 text-white" 
              placeholder="Search conversations..." 
            />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-slate-400">
            <span className="text-xs font-bold uppercase tracking-widest hover:text-slate-200 cursor-pointer">Live Dashboard</span>
            <Notifications className="w-5 h-5 hover:text-white cursor-pointer" />
            <Settings className="w-5 h-5 hover:text-white cursor-pointer" />
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-indigo-500/20">
            New Lead
          </button>
          <div className="w-8 h-8 rounded-full border border-slate-700 bg-indigo-500/20 flex items-center justify-center text-xs font-bold">
            RQ
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col pt-4 pb-8 fixed h-[calc(100vh-64px)] overflow-y-auto">
          <div className="px-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500 rounded flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <CorporateFare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Acme Corp</h3>
                <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest">Admin Account</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-1">
            <NavItem icon={<Monitoring />} label="Analytics Hub" />
            <NavItem icon={<PermMedia />} label="Content Hub" active={currentScreen === 'content'} onClick={() => setCurrentScreen('content')} />
            <NavItem icon={<SmartToy />} label="AI Bot Engine" active={currentScreen === 'bot'} onClick={() => setCurrentScreen('bot')} />
            <NavItem icon={<Leaderboard />} label="Lead Engine" />
          </nav>
          <div className="px-6 mt-auto">
            <button className="w-full bg-slate-800 hover:bg-indigo-500 text-white py-3 rounded text-[10px] font-black uppercase tracking-[0.2em] transition-all mb-6">
              Upgrade Plan
            </button>
            <div className="space-y-1">
              <div className="text-slate-500 flex items-center px-2 py-2 hover:text-indigo-300 transition-colors text-xs font-bold uppercase tracking-widest cursor-pointer">
                <Help className="w-4 h-4 mr-3" /> Help Center
              </div>
              <div className="text-slate-500 flex items-center px-2 py-2 hover:text-indigo-300 transition-colors text-xs font-bold uppercase tracking-widest cursor-pointer">
                <Logout className="w-4 h-4 mr-3" /> Log Out
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        {currentScreen === 'bot' ? (
          <main className="ml-64 flex-1 flex h-full overflow-hidden">
            {/* Threads Column */}
            <section className="w-80 border-r border-slate-800 bg-[#0d1c2d] flex flex-col">
              <div className="p-6 border-b border-slate-800 bg-slate-900/50">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 font-display">
                  Active Threads
                  <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-mono">{threads.length}</span>
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {threads.map(thread => (
                  <div 
                    key={thread.id}
                    onClick={() => setActiveThread(thread)}
                    className={`p-4 border-b border-slate-800 cursor-pointer transition-all relative group
                      ${activeThread?.id === thread.id ? 'bg-indigo-500/10' : 'hover:bg-slate-800/30'}
                    `}
                  >
                    {activeThread?.id === thread.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                    )}
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-widest
                        ${thread.status === 'HOT LEAD' ? 'text-secondary' : thread.status === 'WARM' ? 'text-tertiary' : 'text-slate-500'}
                      `}>{thread.status}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{thread.time}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white mb-1 font-display">{thread.name}</h4>
                    <p className="text-slate-400 text-xs truncate">{thread.lastMsg}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Chat Column */}
            <section className="flex-1 flex flex-col bg-slate-900/20 relative overflow-hidden">
              {activeThread && (
                <>
                  <header className="p-4 border-b border-slate-800 flex items-center justify-between glass-surface z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-indigo-400 border border-slate-700">
                        {activeThread.avatar}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white font-display">{activeThread.name}</h3>
                        <p className="text-[10px] text-secondary font-bold uppercase tracking-widest flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse"></span>
                          AI Bot Active
                        </p>
                      </div>
                    </div>
                    <button className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded flex items-center gap-2 text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                      <FrontHand className="w-4 h-4" /> Take Control
                    </button>
                  </header>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-950/30">
                    {messages.map((msg, i) => (
                      <Message key={i} type={msg.type} content={msg.content} time={msg.time} />
                    ))}
                  </div>

                  {/* Input */}
                  <div className="p-4 glass-surface border-t border-slate-800">
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-2 focus-within:border-indigo-500 transition-colors shadow-inner">
                      <button className="p-2 text-slate-500 hover:text-white transition-colors">
                        <AddCircle className="w-5 h-5" />
                      </button>
                      <input 
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white placeholder:text-slate-600" 
                        placeholder="Type a message or use '/' for AI commands..." 
                      />
                      <button className="bg-indigo-500 text-white p-2 rounded-lg hover:bg-indigo-400 transition-all active:scale-95 shadow-lg shadow-indigo-500/40">
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Intel Panel */}
            <section className="w-80 bg-[#0d1c2d] border-l border-slate-800 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
              {activeThread && (
                <>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Intent Score</h4>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-4xl font-bold text-secondary font-display">{activeThread.score || 0}</span>
                      <span className="text-[10px] text-secondary font-bold uppercase mb-1">Dynamic Rating</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-secondary h-full rounded-full shadow-[0_0_15px_#4edea3]" style={{ width: `${activeThread.score || 0}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Captured Data</h4>
                    <DataField label="Lead Status" value={activeThread.status} info />
                    <DataField label="Platform ID" value={activeThread.id.slice(0, 10) + '...'} verified />
                  </div>

                  <div className="mt-auto pt-6">
                    <div className="p-4 glass-surface rounded-xl border border-indigo-500/20 shadow-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AutoAwesome className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Bot Insight</h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed italic">
                        Real-time AI analysis: {activeThread.status === 'HOT LEAD' ? 'High purchase intent detected. Recommend agent intervention.' : 'Lead is currently exploring products.'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </section>
          </main>
        ) : (
          <TrainingHub />
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #273647;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #464554;
        }
        @font-face {
          font-family: 'Space Grotesk';
          src: url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;900&display=swap');
        }
        .font-display {
          font-family: 'Space Grotesk', sans-serif;
        }
        .active-nav-glow {
          box-shadow: 0 0 15px rgba(192, 193, 255, 0.1);
        }
      `}} />
    </div>
  )
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center px-6 py-3 w-full cursor-pointer transition-all group
      ${active ? 'bg-indigo-500/10 text-indigo-400 border-r-2 border-indigo-500 active-nav-glow' : 'text-slate-500 hover:bg-slate-800/80 hover:text-indigo-300'}
    `}>
      <span className="mr-4">{React.cloneElement(icon, { size: 18 })}</span>
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
    </div>
  )
}

function TrainingHub() {
  const products = [
    { id: 1, name: 'Vestido Rojo Gala', price: 'Bs. 180', category: 'Vestidos', img: 'https://images.unsplash.com/photo-1539008835657-9e8e9680fe0a?q=80&w=400&auto=format&fit=crop' },
    { id: 2, name: 'Sandalias Plata', price: 'Bs. 120', category: 'Calzado', img: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&w=400&auto=format&fit=crop' },
    { id: 3, name: 'Bolso Elegance', price: 'Bs. 250', category: 'Accesorios', img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=400&auto=format&fit=crop' },
  ];

  return (
    <main className="ml-64 flex-1 flex flex-col h-full bg-[#051424] p-8 overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white font-display">Knowledge Hub: Vision & Products</h2>
          <p className="text-slate-400 text-sm">Entrena a la IA para reconocer tus productos y conjuntos.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20">
          <AddCircle className="w-5 h-5" /> Subir Producto
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Galería de Productos */}
        <div className="col-span-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Catálogo de Productos</h3>
            <div className="flex gap-2">
              <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full">Total: {products.length}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {products.map(p => (
              <div key={p.id} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500 transition-all group cursor-pointer shadow-lg hover:shadow-indigo-500/10">
                <div className="aspect-[3/4] bg-slate-800 relative">
                  <img src={p.img} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/20 transition-all"></div>
                </div>
                <div className="p-4 bg-slate-900">
                  <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-secondary font-mono text-xs font-bold">{p.price}</span>
                    <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 uppercase tracking-tighter">{p.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel de Conjuntos (Outfits) */}
        <div className="col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg border-t-4 border-t-indigo-500">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 font-display">
              <AutoAwesome className="w-4 h-4 text-indigo-400" /> Creador de Conjuntos
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Arrastra productos desde el catálogo aquí para crear un **"Look Recomendado"**. La IA lo sugerirá automáticamente.
            </p>
            
            <div className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-3 bg-slate-950/30">
              <AddCircle className="w-8 h-8 opacity-20" />
              Arrastra productos aquí
            </div>

            <button className="w-full mt-6 bg-indigo-500 text-white py-3 rounded-lg text-xs font-bold hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20 uppercase tracking-widest">
              Guardar Nuevo Conjunto
            </button>
          </div>

          <div className="bg-indigo-500/5 border border-indigo-500/20 p-5 rounded-xl">
             <div className="flex items-center gap-2 mb-3">
               <Info className="w-4 h-4 text-indigo-400" />
               <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Visión IA Activa</h4>
             </div>
             <p className="text-xs text-slate-300 leading-relaxed">
               El modelo **Qwen-VL** analiza las fotos subidas. Cuando un cliente envíe una imagen, compararemos las características visuales con tu catálogo para una respuesta instantánea.
             </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Message({ type, content, time }) {
  return (
    <div className={`flex ${type === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className="max-w-[80%]">
        <div className={`p-4 rounded-xl text-sm shadow-md
          ${type === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'glass-surface border border-indigo-500/20 text-white rounded-tl-none'}
        `}>
          {type === 'bot' && (
            <div className="flex items-center gap-2 mb-2">
              <SmartToy className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">OMNI BOT</span>
            </div>
          )}
          {content}
        </div>
        <p className={`text-[10px] text-slate-500 font-mono mt-1 ${type === 'user' ? 'text-right' : 'text-left'}`}>
          {time} • {type === 'user' ? 'User' : 'AI Generated'}
        </p>
      </div>
    </div>
  )
}

function DataField({ label, value, verified, pending, info }) {
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

export default App

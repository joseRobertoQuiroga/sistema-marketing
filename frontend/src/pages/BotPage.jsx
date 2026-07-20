import { useState, useEffect, useCallback, useRef } from 'react'
import client from '../services/apiClient'
import { connectSocket, getSocket, disconnectSocket } from '../services/socket'
import { useAuthStore } from '../stores/authStore'
import ThreadList from '../components/chat/ThreadList'
import ChatWindow from '../components/chat/ChatWindow'
import IntelPanel from '../components/chat/IntelPanel'

export default function BotPage() {
  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [messages, setMessages] = useState([])
  const accessToken = useAuthStore((s) => s.accessToken)
  const activeRef = useRef(null)

  const loadThreads = useCallback(async () => {
    try {
      const { data } = await client.get('/api/conversations')
      const list = data.rows || data
      setThreads(list)
      if (!activeRef.current && list.length) {
        setActiveThread(list[0])
        activeRef.current = list[0]
      }
    } catch (err) {
      console.error('Error fetching threads', err)
    }
  }, [])

  useEffect(() => {
    activeRef.current = activeThread
  }, [activeThread])

  useEffect(() => {
    const socket = connectSocket(accessToken)
    loadThreads()

    const handler = (msg) => {
      if (activeRef.current && msg.conversationId === activeRef.current.id) {
        setMessages(prev => [
          ...prev,
          {
            type: msg.role === 'admin' ? 'admin' : msg.role === 'user' ? 'user' : 'bot',
            content: msg.content,
            time: 'Just now',
          },
        ])
      }
      loadThreads()
    }
    socket.on('new_message', handler)

    return () => {
      socket.off('new_message', handler)
      disconnectSocket()
    }
  }, [accessToken, loadThreads])

  useEffect(() => {
    if (activeThread) {
      loadMessages(activeThread.id)
    }
  }, [activeThread])

  const loadMessages = async (id) => {
    try {
      const { data } = await client.get(`/api/conversations/${id}/messages`)
      setMessages(data.map(m => ({
        type: m.type,
        content: m.content,
        time: new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })))
    } catch (err) {
      console.error('Error fetching messages', err)
    }
  }

  const handleSelectThread = (thread) => {
    setActiveThread(thread)
    activeRef.current = thread
  }

  return (
    <>
      <section className="w-80 border-r border-slate-800 bg-[#0d1c2d] flex flex-col">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 font-display">
            Active Threads
            <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-mono">{threads.length}</span>
          </h2>
        </div>
        <ThreadList threads={threads} activeThread={activeThread} onSelect={handleSelectThread} />
      </section>
      <ChatWindow thread={activeThread} messages={messages} />
      <IntelPanel thread={activeThread} />
    </>
  )
}

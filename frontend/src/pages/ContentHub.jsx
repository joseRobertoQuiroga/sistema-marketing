import { useState, useEffect } from 'react'
import client from '../services/apiClient'
import { PlusCircle, Upload, Calendar, Clock, Send, Trash2, CheckCircle, XCircle } from 'lucide-react'

export default function ContentHub() {
  const [products, setProducts] = useState([])
  const [assets, setAssets] = useState([])
  const [posts, setPosts] = useState([])
  const [activeTab, setActiveTab] = useState('products')
  const [showComposer, setShowComposer] = useState(false)
  const [composer, setComposer] = useState({ content: '', scheduledAt: '' })

  useEffect(() => {
    client.get('/api/products').then(r => setProducts(r.data)).catch(console.error)
    client.get('/api/content/assets').then(r => setAssets(r.data)).catch(console.error)
    client.get('/api/content/posts').then(r => setPosts(r.data)).catch(console.error)
  }, [])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    try {
      await client.post('/api/content/assets/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const { data } = await client.get('/api/content/assets')
      setAssets(data)
    } catch (err) {
      console.error('Upload failed', err)
    }
  }

  const handleCreatePost = async () => {
    if (!composer.content) return
    try {
      await client.post('/api/content/posts', {
        content: composer.content,
        scheduledAt: composer.scheduledAt || null,
      })
      setComposer({ content: '', scheduledAt: '' })
      setShowComposer(false)
      const { data } = await client.get('/api/content/posts')
      setPosts(data)
    } catch (err) {
      console.error('Post creation failed', err)
    }
  }

  const handleDeleteAsset = async (id) => {
    try {
      await client.delete(`/api/content/assets/${id}`)
      setAssets(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      console.error('Delete failed', err)
    }
  }

  const tabs = [
    { key: 'products', label: 'Catálogo' },
    { key: 'assets', label: 'Assets' },
    { key: 'posts', label: 'Publicaciones' },
  ]

  return (
    <div className="flex-1 flex flex-col h-full bg-[#051424] overflow-hidden">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white font-display">Content Hub</h2>
          <p className="text-slate-400 text-sm">Gestiona productos, assets y publicaciones</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800 rounded-lg p-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded text-xs font-bold transition-all ${
                  activeTab === tab.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >{tab.label}</button>
            ))}
          </div>
          {activeTab === 'posts' && (
            <button onClick={() => setShowComposer(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
            ><PlusCircle className="w-4 h-4" /> Nueva Publicación</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'products' && (
          <div className="grid grid-cols-4 gap-6">
            {products.map(p => (
              <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500 transition-all group cursor-pointer">
                <div className="aspect-[3/4] bg-slate-800 relative overflow-hidden">
                  <img src={p.image_url || 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&w=400&auto=format&fit=crop'} alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-4">
                  <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-secondary font-mono text-xs font-bold">{p.currency || 'Bs.'} {p.price}</span>
                    <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 uppercase">{p.category || 'Producto'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'assets' && (
          <div>
            <label className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer mb-6">
              <Upload className="w-4 h-4" /> Subir Asset
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
            <div className="grid grid-cols-6 gap-4">
              {assets.map(a => (
                <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden group relative">
                  <img src={a.variants?.thumbnail || a.url} alt={a.alt_text || a.original_name}
                    className="w-full aspect-square object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                    <button onClick={() => handleDeleteAsset(a.id)}
                      className="bg-red-500 hover:bg-red-400 text-white p-2 rounded-full"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] text-slate-400 truncate">{a.original_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="space-y-4">
            {posts.map(post => (
              <div key={post.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {post.status === 'published' ? <CheckCircle className="w-4 h-4 text-secondary" /> :
                     post.status === 'failed' ? <XCircle className="w-4 h-4 text-red-400" /> :
                     <Clock className="w-4 h-4 text-amber-400" />}
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{post.status}</span>
                  </div>
                  {post.scheduled_at && (
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.scheduled_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white mb-3">{post.content}</p>
                {post.published_at && (
                  <p className="text-[10px] text-slate-600">Publicado {new Date(post.published_at).toLocaleString()}</p>
                )}
              </div>
            ))}
            {posts.length === 0 && (
              <div className="text-center py-16 text-slate-600">
                <Send className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">No hay publicaciones aún</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showComposer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowComposer(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-lg m-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4 font-display">Nueva Publicación</h3>
            <textarea
              value={composer.content}
              onChange={e => setComposer({ ...composer, content: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm min-h-[120px] outline-none focus:border-indigo-500 resize-none"
              placeholder="Escribe el contenido de la publicación..."
            />
            <div className="mt-4">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Programar para</label>
              <input type="datetime-local" value={composer.scheduledAt} onChange={e => setComposer({ ...composer, scheduledAt: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-indigo-500" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowComposer(false)}
                className="flex-1 bg-slate-800 text-white py-2 rounded-lg text-xs font-bold hover:bg-slate-700 transition-all">Cancelar</button>
              <button onClick={handleCreatePost}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-indigo-500 transition-all flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> {composer.scheduledAt ? 'Programar' : 'Publicar Ahora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

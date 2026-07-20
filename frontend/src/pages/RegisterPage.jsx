import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', name: '', orgName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const register = useAuthStore((s) => s.register)
  const navigate = useNavigate()

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form.email, form.password, form.name, form.orgName)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#051424] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tighter text-white font-display">OmniPresence Suite</h1>
          <p className="text-slate-400 text-sm mt-2">Crea tu cuenta gratuita</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-4 shadow-xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-4 py-2">{error}</div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Nombre</label>
            <input name="name" value={form.name} onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:border-indigo-500 outline-none"
              placeholder="Tu nombre" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:border-indigo-500 outline-none"
              placeholder="tu@email.com" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Contraseña</label>
            <input type="password" name="password" value={form.password} onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:border-indigo-500 outline-none"
              placeholder="Mínimo 6 caracteres" required minLength={6} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Nombre de la Empresa</label>
            <input name="orgName" value={form.orgName} onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:border-indigo-500 outline-none"
              placeholder="Mi Empresa" required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {loading ? 'Creando cuenta...' : 'Crear Cuenta Gratuita'}
          </button>
          <p className="text-center text-xs text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-bold">Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

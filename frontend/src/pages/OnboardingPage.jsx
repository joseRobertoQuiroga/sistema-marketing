import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Share2, Database, Rocket, Check } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

const steps = [
  { icon: Rocket, title: 'Bienvenido', description: 'Configura tu asistente de ventas IA en minutos' },
  { icon: Bot, title: 'Configurar Bot', description: 'Personaliza el tono y nombre de tu bot' },
  { icon: Share2, title: 'Conectar Red', description: 'Conecta Telegram o WhatsApp' },
  { icon: Database, title: 'Primer Producto', description: 'Sube tu catálogo inicial' },
]

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [config, setConfig] = useState({ businessName: '', tone: 'amigable', platform: 'telegram' })
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      navigate('/')
    }
  }

  const handleSkip = () => navigate('/')

  return (
    <div className="min-h-screen bg-[#051424] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i === currentStep ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' :
                  i < currentStep ? 'bg-secondary/20 text-secondary' : 'bg-slate-800 text-slate-600'
                }`}>
                  {i < currentStep ? <Check className="w-5 h-5" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-12 h-0.5 mx-1 ${i < currentStep ? 'bg-secondary' : 'bg-slate-800'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl">
          {currentStep === 0 && (
            <div className="text-center">
              <Rocket className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white font-display mb-2">¡Bienvenido, {user?.name || 'Emprendedor'}!</h2>
              <p className="text-slate-400 text-sm mb-2">
                OmniPresence Suite te ayudará a automatizar tus ventas con IA.
              </p>
              <p className="text-slate-500 text-xs">
                En 3 pasos tendrás tu bot de ventas funcionando.
              </p>
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <Bot className="w-12 h-12 text-indigo-400 mb-4" />
              <h2 className="text-xl font-bold text-white font-display mb-4">Configura tu Bot</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Nombre de tu negocio</label>
                  <input value={config.businessName} onChange={e => setConfig({ ...config, businessName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
                    placeholder="Ej: Tienda de Moda" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Tono del bot</label>
                  <select value={config.tone} onChange={e => setConfig({ ...config, tone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500">
                    <option value="amigable">Amigable</option>
                    <option value="formal">Formal</option>
                    <option value="dinámico">Dinámico</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <Share2 className="w-12 h-12 text-indigo-400 mb-4" />
              <h2 className="text-xl font-bold text-white font-display mb-4">Conecta tu Red Social</h2>
              <p className="text-slate-400 text-sm mb-6">Elige por dónde recibirás mensajes de clientes</p>
              <div className="space-y-3">
                {[
                  { value: 'telegram', label: 'Telegram', desc: 'Mensajería instantánea con bot' },
                  { value: 'whatsapp', label: 'WhatsApp', desc: 'Meta Cloud API (requiere configuración)' },
                ].map(p => (
                  <label key={p.value}
                    className={`flex items-center gap-4 bg-slate-800 border rounded-lg p-4 cursor-pointer transition-all ${
                      config.platform === p.value ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'
                    }`}>
                    <input type="radio" name="platform" value={p.value} checked={config.platform === p.value}
                      onChange={e => setConfig({ ...config, platform: e.target.value })} className="accent-indigo-500" />
                    <div>
                      <p className="text-sm font-bold text-white">{p.label}</p>
                      <p className="text-[10px] text-slate-500">{p.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="text-center">
              <Database className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white font-display mb-2">¡Todo listo!</h2>
              <p className="text-slate-400 text-sm mb-6">
                Puedes empezar a agregar productos a tu catálogo desde el Content Hub.
              </p>
              <div className="bg-slate-800 rounded-lg p-4 text-left">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Resumen</h4>
                <div className="space-y-2 text-sm text-slate-300">
                  <p>🏪 Negocio: <strong>{config.businessName || 'Pendiente'}</strong></p>
                  <p>🎯 Tono: <strong>{config.tone}</strong></p>
                  <p>📱 Plataforma: <strong>{config.platform}</strong></p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <button onClick={handleSkip} className="text-slate-500 text-xs font-bold hover:text-slate-300 transition-all">
              Saltar onboarding
            </button>
            <button onClick={handleNext}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-lg text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20">
              {currentStep < steps.length - 1 ? 'Continuar' : 'Ir al Dashboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import client from '../services/apiClient'
import { useAuthStore } from '../stores/authStore'

const plans = [
  {
    name: 'Free',
    price: 0,
    currency: 'Bs.',
    interval: '/mes',
    description: 'Para empezar a probar',
    features: [
      { text: '500 mensajes de bot/mes', included: true },
      { text: '1 plataforma (Telegram o WhatsApp)', included: true },
      { text: '10 productos en catálogo', included: true },
      { text: '1 miembro del equipo', included: true },
      { text: 'Leads CRM básico', included: true },
      { text: 'Analytics básicos', included: false },
      { text: 'Content Hub', included: false },
      { text: 'Soporte prioritario', included: false },
    ],
    priceId: null,
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 199,
    currency: 'Bs.',
    interval: '/mes',
    description: 'Para negocios en crecimiento',
    features: [
      { text: '5,000 mensajes de bot/mes', included: true },
      { text: '2 plataformas', included: true },
      { text: '50 productos en catálogo', included: true },
      { text: '5 miembros del equipo', included: true },
      { text: 'Leads CRM avanzado', included: true },
      { text: 'Analytics básicos', included: true },
      { text: 'Content Hub', included: true },
      { text: 'Soporte prioritario', included: false },
    ],
    priceId: 'price_pro_monthly',
    highlighted: true,
  },
  {
    name: 'Business',
    price: 499,
    currency: 'Bs.',
    interval: '/mes',
    description: 'Para equipos dedicados',
    features: [
      { text: '50,000 mensajes de bot/mes', included: true },
      { text: '5 plataformas', included: true },
      { text: '200 productos en catálogo', included: true },
      { text: '15 miembros del equipo', included: true },
      { text: 'Leads CRM avanzado', included: true },
      { text: 'Analytics completos', included: true },
      { text: 'Content Hub', included: true },
      { text: 'Soporte prioritario', included: true },
    ],
    priceId: 'price_business_monthly',
    highlighted: false,
  },
  {
    name: 'Agency',
    price: 999,
    currency: 'Bs.',
    interval: '/mes',
    description: 'Para agencias y multi-tenant',
    features: [
      { text: 'Mensajes ilimitados', included: true },
      { text: '10 plataformas', included: true },
      { text: 'Productos ilimitados', included: true },
      { text: 'Miembros ilimitados', included: true },
      { text: 'Leads CRM avanzado', included: true },
      { text: 'Analytics completos', included: true },
      { text: 'Content Hub premium', included: true },
      { text: 'Soporte 24/7 dedicado', included: true },
    ],
    priceId: 'price_agency_monthly',
    highlighted: false,
  },
]

export default function PlansPage() {
  const [loading, setLoading] = useState(null)
  const org = useAuthStore((s) => s.org)

  const handleUpgrade = async (priceId) => {
    if (!priceId) return
    setLoading(priceId)
    try {
      const { data } = await client.post('/api/billing/create-checkout-session', {
        priceId,
        successUrl: `${window.location.origin}/settings`,
        cancelUrl: window.location.href,
      })
      window.location.href = data.url
    } catch (err) {
      console.error('Error creating checkout session', err)
    } finally {
      setLoading(null)
    }
  }

  const handleManageSubscription = async () => {
    setLoading('manage')
    try {
      const { data } = await client.post('/api/billing/create-portal-session')
      window.location.href = data.url
    } catch (err) {
      console.error('Error creating portal session', err)
    } finally {
      setLoading(null)
    }
  }

  const currentPlan = org?.plan || 'free'

  return (
    <div className="flex-1 flex flex-col bg-[#051424] overflow-y-auto">
      <div className="p-8 border-b border-slate-800">
        <h2 className="text-2xl font-bold text-white font-display">Planes y Precios</h2>
        <p className="text-slate-400 text-sm mt-1">Elige el plan que mejor se adapte a tu negocio</p>
      </div>

      <div className="p-8 grid grid-cols-4 gap-6">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.name.toLowerCase()
          return (
            <div
              key={plan.name}
              className={`relative bg-slate-900 border rounded-xl p-6 flex flex-col transition-all ${
                plan.highlighted
                  ? 'border-indigo-500 shadow-lg shadow-indigo-500/10 scale-105'
                  : 'border-slate-800 hover:border-slate-600'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full">
                  Recomendado
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white font-display">{plan.name}</h3>
                <p className="text-slate-400 text-xs mt-1">{plan.description}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-black text-white font-display">{plan.currency}{plan.price}</span>
                <span className="text-slate-500 text-sm ml-1">{plan.interval}</span>
              </div>
              <div className="flex-1 space-y-3 mb-8">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {f.included ? (
                      <Check className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
                    )}
                    <span className={`text-xs ${f.included ? 'text-slate-300' : 'text-slate-600'}`}>{f.text}</span>
                  </div>
                ))}
              </div>
              {isCurrent ? (
                <button
                  onClick={handleManageSubscription}
                  disabled={loading === 'manage'}
                  className="w-full bg-slate-800 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all hover:bg-slate-700 disabled:opacity-50"
                >
                  {loading === 'manage' ? '...' : 'Gestionar Suscripción'}
                </button>
              ) : plan.price === 0 ? (
                <div className="w-full bg-slate-800/50 text-slate-500 py-3 rounded-lg text-xs font-bold uppercase tracking-widest text-center">
                  Plan Actual
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.priceId)}
                  disabled={loading === plan.priceId}
                  className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${
                    plan.highlighted
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                      : 'bg-slate-800 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {loading === plan.priceId ? 'Redirigiendo...' : 'Actualizar'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

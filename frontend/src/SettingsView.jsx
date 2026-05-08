import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Settings, Users, CreditCard, Link as LinkIcon, AlertCircle, 
    CheckCircle2, X, Plus, Shield, Activity, AlertTriangle, RefreshCw,
    Clock, Zap
} from 'lucide-react';

const API_URL = 'http://localhost:3000/api/channels';

// Mapa de plataformas soportadas
const PLATFORMS = [
    { 
        id: 'meta', 
        name: 'Meta (Facebook & Instagram)', 
        description: 'Sincroniza métricas de alcance, responde DMs y programa publicaciones en FB e IG.', 
        color: 'text-blue-400', 
        bg: 'bg-blue-500/10',
        borderHover: 'hover:border-blue-500/40',
        oauthKey: 'meta'
    },
    { 
        id: 'linkedin', 
        name: 'LinkedIn Marketing', 
        description: 'Métricas de páginas corporativas, engagement profesional y publicación de contenido.', 
        color: 'text-sky-400', 
        bg: 'bg-sky-500/10',
        borderHover: 'hover:border-sky-500/40',
        oauthKey: 'linkedin'
    },
    { 
        id: 'tiktok', 
        name: 'TikTok Business', 
        description: 'Analíticas avanzadas de videos, views, engagement rate y perfil comercial.', 
        color: 'text-pink-400', 
        bg: 'bg-pink-500/10',
        borderHover: 'hover:border-pink-500/40',
        oauthKey: 'tiktok'
    }
];

export default function SettingsView() {
    const [activeTab, setActiveTab] = useState('integrations');
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState(null);
    const [formData, setFormData] = useState({ app_id: '', app_secret: '' });
    const [error, setError] = useState('');
    const [syncing, setSyncing] = useState(false);

    const fetchChannels = async () => {
        try {
            const res = await axios.get(API_URL);
            setChannels(res.data.channels || []);
        } catch (err) {
            console.error('Error fetching channels:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChannels();
    }, []);

    const handleConnect = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await axios.post(`${API_URL}/connect`, {
                platform: selectedPlatform.id,
                app_id: formData.app_id,
                app_secret: formData.app_secret
            });
            setShowModal(false);
            setFormData({ app_id: '', app_secret: '' });
            fetchChannels();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al conectar la plataforma');
        }
    };

    const handleOAuth = async (platform) => {
        try {
            const res = await axios.get(`${API_URL}/oauth/${platform}/init`);
            if (res.data.auth_url) {
                window.location.href = res.data.auth_url;
            }
        } catch (err) {
            // Si las credenciales no están configuradas, mostrar modal manual
            const pl = PLATFORMS.find(p => p.oauthKey === platform);
            if (pl) openConnectModal(pl);
        }
    };

    const handleDisconnect = async (id) => {
        if (!window.confirm('¿Desconectar esta plataforma? Se detendrá la sincronización de métricas.')) return;
        try {
            await axios.delete(`${API_URL}/${id}`);
            fetchChannels();
        } catch (err) {
            console.error('Error disconnecting:', err);
        }
    };

    const handleForceSync = async () => {
        setSyncing(true);
        setTimeout(() => {
            setSyncing(false);
            fetchChannels();
        }, 2000);
    };

    const openConnectModal = (platform) => {
        setSelectedPlatform(platform);
        setShowModal(true);
        setError('');
    };

    // Canales con alerta de expiración
    const expiringChannels = channels.filter(c => c.expiry_warning);

    return (
        <div className="flex-1 bg-[#051424] text-[#d4e4fa] font-sans flex overflow-hidden">
            
            {/* Sidebar de Configuración */}
            <div className="w-64 border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-2 flex-shrink-0">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Ajustes</h2>
                {[
                    { key: 'integrations', icon: <LinkIcon className="w-4 h-4" />, label: 'Integraciones' },
                    { key: 'team', icon: <Users className="w-4 h-4" />, label: 'Equipo' },
                    { key: 'billing', icon: <CreditCard className="w-4 h-4" />, label: 'Facturación' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all text-left ${
                            activeTab === tab.key 
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                                : 'text-slate-400 hover:bg-slate-800'
                        }`}
                    >
                        {tab.icon} {tab.label}
                        {tab.key === 'integrations' && expiringChannels.length > 0 && (
                            <span className="ml-auto bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                {expiringChannels.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Contenido Principal */}
            <div className="flex-1 p-10 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-8">
                    
                    {/* ==================== INTEGRACIONES ==================== */}
                    {activeTab === 'integrations' && (
                        <div className="space-y-8">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-white mb-2">Canales Sociales</h1>
                                    <p className="text-slate-400 text-sm">Conecta tus redes para sincronizar métricas, activar el bot y publicar contenido.</p>
                                </div>
                                <button
                                    onClick={handleForceSync}
                                    disabled={syncing}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                                    {syncing ? 'Sincronizando...' : 'Forzar Sync'}
                                </button>
                            </div>

                            {/* Banner de alerta si algún token está por expirar */}
                            {expiringChannels.length > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-400">Tokens Próximos a Expirar</h4>
                                        <p className="text-xs text-amber-200 mt-1">
                                            {expiringChannels.map(c => c.platform).join(', ')} — Reconecta para mantener la sincronización activa y evitar interrupciones en el Analytics Hub.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-5">
                                {PLATFORMS.map(platform => {
                                    const connected = channels.find(c => 
                                        c.platform === platform.id || 
                                        c.platform === platform.oauthKey ||
                                        (platform.id === 'meta' && (c.platform === 'instagram' || c.platform === 'facebook'))
                                    );
                                    const isExpiring = connected?.expiry_warning;
                                    
                                    return (
                                        <div 
                                            key={platform.id} 
                                            className={`bg-slate-900 border rounded-xl p-6 flex items-center justify-between transition-all ${
                                                isExpiring ? 'border-amber-500/30' : `border-slate-800 ${platform.borderHover}`
                                            }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${platform.bg} border border-slate-800/50`}>
                                                    <Activity className={`w-6 h-6 ${platform.color}`} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-bold text-white">{platform.name}</h3>
                                                        {connected && !isExpiring && (
                                                            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold border border-emerald-500/20 flex items-center gap-1">
                                                                <CheckCircle2 className="w-3 h-3"/> Activo
                                                            </span>
                                                        )}
                                                        {isExpiring && (
                                                            <span className="bg-amber-500/10 text-amber-400 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold border border-amber-500/20 flex items-center gap-1">
                                                                <Clock className="w-3 h-3"/> Expira en {connected.days_until_expiry}d
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-1">{platform.description}</p>
                                                    {connected && (
                                                        <p className={`text-xs mt-2 font-mono inline-block px-2 py-1 rounded ${platform.color} ${platform.bg}`}>
                                                            {connected.account_name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-2 flex-shrink-0">
                                                {connected ? (
                                                    <>
                                                        {isExpiring && (
                                                            <button 
                                                                onClick={() => handleOAuth(platform.oauthKey)}
                                                                className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 text-xs font-bold transition-colors flex items-center gap-1"
                                                            >
                                                                <Zap className="w-3.5 h-3.5"/> Renovar
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleDisconnect(connected.id)}
                                                            className="px-4 py-2 bg-slate-800 hover:bg-red-500/10 text-slate-300 hover:text-red-400 rounded border border-slate-700 hover:border-red-500/30 text-xs font-bold transition-colors"
                                                        >
                                                            Desconectar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleOAuth(platform.oauthKey)}
                                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold shadow-lg shadow-indigo-500/20 transition-transform active:scale-95 flex items-center gap-2"
                                                    >
                                                        <LinkIcon className="w-4 h-4"/> Conectar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ==================== EQUIPO ==================== */}
                    {activeTab === 'team' && (
                        <div className="space-y-8">
                            <div>
                                <h1 className="text-2xl font-bold text-white mb-2">Gestión de Equipo</h1>
                                <p className="text-slate-400 text-sm">Invita a miembros de tu agencia para colaborar en la plataforma.</p>
                            </div>
                            
                            <div className="bg-slate-900 border border-slate-800 rounded-xl">
                                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-white">Miembros Actuales</h3>
                                        <p className="text-xs text-slate-500 mt-1">1 de 3 asientos usados (Plan Pro)</p>
                                    </div>
                                    <button className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded flex items-center gap-2 hover:bg-indigo-500">
                                        <Plus className="w-4 h-4"/> Invitar
                                    </button>
                                </div>
                                <div className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm font-black text-indigo-400">RQ</div>
                                    <div>
                                        <div className="text-sm font-bold text-white">Roberto Quiroga</div>
                                        <div className="text-xs text-slate-400">Super Admin • Último acceso: hace 2 minutos</div>
                                    </div>
                                    <span className="ml-auto text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-1 rounded font-bold">OWNER</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== FACTURACIÓN ==================== */}
                    {activeTab === 'billing' && (
                        <div className="space-y-8">
                            <div>
                                <h1 className="text-2xl font-bold text-white mb-2">Facturación y Planes</h1>
                                <p className="text-slate-400 text-sm">Gestiona tu suscripción y métodos de pago.</p>
                            </div>
                            
                            <div className="grid md:grid-cols-3 gap-4">
                                {[
                                    { name: 'Starter', price: '$9', channels: 1, leads: 100, active: false },
                                    { name: 'Pro', price: '$29', channels: 3, leads: 500, active: true },
                                    { name: 'Agency', price: '$79', channels: 10, leads: 5000, active: false }
                                ].map(plan => (
                                    <div key={plan.name} className={`rounded-xl p-6 border relative overflow-hidden ${plan.active ? 'bg-slate-900 border-indigo-500/40' : 'bg-slate-900/50 border-slate-800'}`}>
                                        {plan.active && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500" />}
                                        {plan.active && <div className="absolute top-3 right-3 text-[9px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">PLAN ACTUAL</div>}
                                        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                                        <div className="text-3xl font-black text-white mt-2">{plan.price}<span className="text-sm font-normal text-slate-400">/mes</span></div>
                                        <ul className="mt-4 space-y-2 text-xs text-slate-300">
                                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400"/> {plan.channels} canales sociales</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400"/> {plan.leads.toLocaleString()} leads/mes</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400"/> Analytics Hub completo</li>
                                        </ul>
                                        <button className={`w-full mt-6 py-2 rounded text-xs font-bold transition-colors ${plan.active ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>
                                            {plan.active ? 'Gestionar' : 'Cambiar a ' + plan.name}
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 text-slate-400"/> Método de Pago
                                </h3>
                                <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-lg border border-slate-800 mb-4">
                                    <div className="w-12 h-8 bg-slate-700 rounded flex items-center justify-center font-black text-[10px] text-white">VISA</div>
                                    <div>
                                        <div className="text-sm text-white font-mono">•••• •••• •••• 4242</div>
                                        <div className="text-xs text-slate-500">Expira 12/28</div>
                                    </div>
                                    <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">ACTIVA</span>
                                </div>
                                <button className="w-full py-2 text-indigo-400 rounded text-xs font-bold hover:bg-indigo-500/10 transition-colors border border-indigo-500/20">
                                    + Agregar método de pago
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Conexión (fallback cuando OAuth no está configurado) */}
            {showModal && selectedPlatform && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl shadow-indigo-500/10">
                        <div className="flex justify-between items-center p-6 border-b border-slate-800">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <LinkIcon className="w-5 h-5 text-indigo-400" />
                                Conectar {selectedPlatform.name}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleConnect} className="p-6 space-y-4">
                            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg flex items-start gap-3">
                                <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="text-xs text-blue-200 leading-relaxed">
                                    <strong className="text-blue-300">Modo Desarrollo:</strong> Ingresa tus credenciales de API. 
                                    Cuando configures el <code className="bg-blue-900/30 px-1 rounded">.env</code>, 
                                    el botón "Conectar" te redirigirá directamente al flujo OAuth oficial de {selectedPlatform.name}.
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">App ID / Client ID</label>
                                <input 
                                    type="text" required
                                    value={formData.app_id}
                                    onChange={e => setFormData({...formData, app_id: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                    placeholder="ej. 123456789012345"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">App Secret</label>
                                <input 
                                    type="password" required
                                    value={formData.app_secret}
                                    onChange={e => setFormData({...formData, app_secret: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                    placeholder="••••••••••••••••"
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit"
                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20 transition-transform active:scale-95">
                                    Conectar Canal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

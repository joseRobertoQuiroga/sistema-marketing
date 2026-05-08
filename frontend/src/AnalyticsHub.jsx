import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
    TrendingUp, Users, DollarSign, Activity, MousePointerClick, ChevronUp, Download, Filter, AlertTriangle, BellRing
} from 'lucide-react';

const API_URL = 'http://localhost:3000/api/analytics';

export default function AnalyticsHub() {
    const [overview, setOverview] = useState(null);
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);
    const [channel, setChannel] = useState('all');

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const [overviewRes, channelsRes] = await Promise.all([
                    axios.get(`${API_URL}/overview?days=${days}&channel=${channel}`),
                    axios.get(`${API_URL}/channels`)
                ]);
                setOverview(overviewRes.data);
                setChannels(channelsRes.data.channels);
            } catch (error) {
                console.error('Error fetching analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [days, channel]);

    const handleExportCSV = () => {
        window.open(`${API_URL}/export?format=csv&days=${days}`, '_blank');
    };

    if (loading || !overview) return <div className="p-8 text-center text-gray-500">Cargando métricas...</div>;

    const { kpis, evolution, top_posts } = overview;

    return (
        <div className="flex-1 bg-[#1A1A1D] text-white p-8 overflow-y-auto h-full">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Header & Controls */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                            Analytics Hub
                        </h1>
                        <p className="text-gray-400 mt-2">Vista unificada del rendimiento en todos tus canales.</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {/* Filtros */}
                        <div className="flex items-center bg-[#252529] border border-[#333338] rounded-lg p-1">
                            <select 
                                value={channel} 
                                onChange={(e) => setChannel(e.target.value)}
                                className="bg-transparent text-sm text-gray-300 focus:outline-none px-3 py-2 cursor-pointer"
                            >
                                <option value="all">Todos los canales</option>
                                <option value="instagram">Instagram</option>
                                <option value="facebook">Facebook</option>
                                <option value="tiktok">TikTok</option>
                            </select>
                            <div className="w-px h-5 bg-[#333338] mx-2"></div>
                            <select 
                                value={days} 
                                onChange={(e) => setDays(Number(e.target.value))}
                                className="bg-transparent text-sm text-gray-300 focus:outline-none px-3 py-2 cursor-pointer"
                            >
                                <option value={7}>Últimos 7 días</option>
                                <option value={30}>Últimos 30 días</option>
                            </select>
                        </div>
                        
                        {/* Botón Exportar */}
                        <button 
                            onClick={handleExportCSV}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                        >
                            <Download className="w-4 h-4" /> Exportar CSV
                        </button>
                    </div>
                </div>

                {/* Panel de Alertas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">Alerta de Seguridad</h4>
                            <p className="text-xs text-red-200 mt-1">El token de la API de Facebook expira en 3 días. Por favor, reautentica la conexión en la vista de Ajustes.</p>
                        </div>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-start gap-3">
                        <BellRing className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Pico de Interacción</h4>
                            <p className="text-xs text-emerald-200 mt-1">Tu publicación en Instagram ha superado el 12% de engagement rate. Te sugerimos aumentar el presupuesto de esta campaña.</p>
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard 
                        title="Alcance Total" 
                        value={kpis.total_reach.toLocaleString()} 
                        icon={<Users className="w-5 h-5 text-blue-400" />}
                        trend="+12%"
                    />
                    <KpiCard 
                        title="Engagement Promedio" 
                        value={`${kpis.engagement_rate}%`} 
                        icon={<Activity className="w-5 h-5 text-green-400" />}
                        trend="+1.2%"
                    />
                    <KpiCard 
                        title="Leads Generados" 
                        value={kpis.leads_generated} 
                        icon={<MousePointerClick className="w-5 h-5 text-purple-400" />}
                        trend="+24"
                    />
                    <KpiCard 
                        title="Costo por Lead" 
                        value={`$${kpis.cpl.toFixed(2)}`} 
                        icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
                        trend="-5%"
                        trendDownGood
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Evolution Chart */}
                    <div className="lg:col-span-2 bg-[#252529] border border-[#333338] rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-6">Evolución de Alcance e Interacciones</h2>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={evolution}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <XAxis 
                                        dataKey="date" 
                                        stroke="#888" 
                                        tick={{ fill: '#888', fontSize: 12 }} 
                                        tickFormatter={(val) => new Date(val).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                    />
                                    <YAxis yAxisId="left" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1A1A1D', border: '1px solid #333', borderRadius: '8px' }}
                                        labelStyle={{ color: '#888' }}
                                    />
                                    <Legend />
                                    <Line yAxisId="left" type="monotone" name="Alcance" dataKey="reach" stroke="#60A5FA" strokeWidth={2} dot={false} />
                                    <Line yAxisId="right" type="monotone" name="Conversiones" dataKey="conversions" stroke="#A78BFA" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Channels Breakdown */}
                    <div className="bg-[#252529] border border-[#333338] rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-6">Rendimiento por Canal</h2>
                        <div className="space-y-4">
                            {channels.map(channel => (
                                <div key={channel.platform} className="bg-[#1A1A1D] p-4 rounded-lg border border-[#333338]">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="capitalize font-medium">{channel.platform}</span>
                                            <span className="text-xs text-gray-500">{channel.account_name}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div>
                                            <div className="text-xs text-gray-500 uppercase">Seguidores</div>
                                            <div className="font-semibold">{channel.followers.toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 uppercase">Engagement</div>
                                            <div className="font-semibold text-green-400">{channel.engagement_rate}%</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top Posts Table */}
                <div className="bg-[#252529] border border-[#333338] rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-6">Publicaciones Destacadas</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-gray-400 border-b border-[#333338]">
                                <tr>
                                    <th className="pb-3 font-medium">Contenido</th>
                                    <th className="pb-3 font-medium">Plataforma</th>
                                    <th className="pb-3 font-medium">Alcance</th>
                                    <th className="pb-3 font-medium">Engagement</th>
                                    <th className="pb-3 font-medium">Fecha</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#333338]">
                                {top_posts.map(post => (
                                    <tr key={post.id} className="hover:bg-[#1A1A1D]/50 transition-colors">
                                        <td className="py-4 pr-4">
                                            <p className="line-clamp-2 text-gray-200">{post.content}</p>
                                        </td>
                                        <td className="py-4 capitalize">
                                            <span className="px-2 py-1 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                {post.platform}
                                            </span>
                                        </td>
                                        <td className="py-4">{post.reach.toLocaleString()}</td>
                                        <td className="py-4 text-green-400">{post.engagement_rate}%</td>
                                        <td className="py-4 text-gray-500">
                                            {new Date(post.published_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}

function KpiCard({ title, value, icon, trend, trendDownGood = false }) {
    const isPositive = trend.startsWith('+');
    const isGood = isPositive ? !trendDownGood : trendDownGood;

    return (
        <div className="bg-[#252529] border border-[#333338] p-5 rounded-xl flex flex-col hover:border-gray-600 transition-colors">
            <div className="flex justify-between items-start mb-4">
                <div className="text-gray-400 text-sm font-medium">{title}</div>
                <div className="p-2 bg-[#1A1A1D] rounded-lg border border-[#333338]">
                    {icon}
                </div>
            </div>
            <div className="text-2xl font-bold mb-2">{value}</div>
            <div className="flex items-center gap-1 text-xs">
                <TrendingUp className={`w-3 h-3 ${isGood ? 'text-green-400' : 'text-red-400'} ${!isPositive && 'rotate-180'}`} />
                <span className={isGood ? 'text-green-400' : 'text-red-400'}>{trend} vs mes anterior</span>
            </div>
        </div>
    );
}

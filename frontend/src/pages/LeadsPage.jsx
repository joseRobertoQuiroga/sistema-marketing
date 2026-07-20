import { useEffect, useState } from 'react'
import { useLeadStore } from '../stores/leadStore'
import { ChevronRight, Bot } from 'lucide-react'

const columns = [
  { key: 'new', label: 'New', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { key: 'contacted', label: 'Contacted', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { key: 'qualified', label: 'Qualified', color: 'text-secondary', bg: 'bg-secondary/10' },
  { key: 'converted', label: 'Converted', color: 'text-green-400', bg: 'bg-green-500/10' },
  { key: 'lost', label: 'Lost', color: 'text-red-400', bg: 'bg-red-500/10' },
]

export default function LeadsPage() {
  const { leads, loading, fetchLeads, updateLead, setSelectedLead, selectedLead } = useLeadStore()
  const [dragging, setDragging] = useState(null)

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const grouped = columns.reduce((acc, col) => {
    acc[col.key] = leads.filter((l) => l.status === col.key)
    return acc
  }, {})

  const handleDrop = async (leadId, newStatus) => {
    if (!dragging || dragging === newStatus) return
    await updateLead(leadId, { status: newStatus })
    setDragging(null)
  }

  const scoreColor = (score) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 50) return 'text-amber-400'
    return 'text-slate-500'
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#051424]">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#051424] overflow-hidden">
      <div className="p-6 border-b border-slate-800">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white font-display">Lead Engine</h2>
            <p className="text-slate-400 text-sm">{leads.length} leads capturados por la IA</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 p-6 overflow-x-auto custom-scrollbar">
        {columns.map((col) => {
          const columnLeads = grouped[col.key] || []
          return (
            <div
              key={col.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(dragging, col.key)}
              className="flex-1 min-w-[220px] max-w-[300px] bg-slate-900/30 border border-slate-800 rounded-xl flex flex-col"
            >
              <div className={`p-4 border-b border-slate-800 flex items-center justify-between ${col.bg}`}>
                <span className={`text-xs font-bold uppercase tracking-widest ${col.color}`}>{col.label}</span>
                <span className="text-xs text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded-full">{columnLeads.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {columnLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragging(lead.id)}
                    onClick={() => setSelectedLead(lead)}
                    className={`bg-slate-900 border border-slate-800 rounded-lg p-4 cursor-pointer hover:border-indigo-500/50 transition-all group ${selectedLead?.id === lead.id ? 'border-indigo-500 ring-1 ring-indigo-500' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-white truncate font-display">{lead.name}</h4>
                      <span className={`text-xs font-mono font-bold ${scoreColor(lead.score)}`}>{lead.score}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider">
                      <Bot className="w-3 h-3" />
                      <span>{lead.source}</span>
                      <ChevronRight className="w-3 h-3" />
                      <span className="text-slate-400">{lead.contactInfo?.localidad || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

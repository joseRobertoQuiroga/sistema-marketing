import { create } from 'zustand'
import client from '../services/apiClient'

export const useLeadStore = create((set, get) => ({
  leads: [],
  loading: false,
  error: null,
  selectedLead: null,

  fetchLeads: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await client.get('/api/leads')
      set({ leads: data, loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  updateLead: async (id, updates) => {
    try {
      const { data } = await client.patch(`/api/leads/${id}`, updates)
      set((state) => ({
        leads: state.leads.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        selectedLead: state.selectedLead?.id === id ? { ...state.selectedLead, ...updates } : state.selectedLead,
      }))
      return data
    } catch (err) {
      console.error('Error updating lead', err)
    }
  },

  setSelectedLead: (lead) => set({ selectedLead: lead }),
}))

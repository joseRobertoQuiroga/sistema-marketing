import { create } from 'zustand'
import axios from 'axios'
import { API_URL } from '../services/api'

const api = axios.create({ baseURL: API_URL })

export const useAuthStore = create((set, get) => ({
  user: null,
  org: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    set({
      user: data.user,
      org: data.org,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      isAuthenticated: true,
      isLoading: false,
    })
    localStorage.setItem('refreshToken', data.refreshToken)
    return data
  },

  register: async (email, password, name, orgName) => {
    const { data } = await api.post('/auth/register', { email, password, name, orgName })
    set({
      user: data.user,
      org: data.org,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      isAuthenticated: true,
      isLoading: false,
    })
    localStorage.setItem('refreshToken', data.refreshToken)
    return data
  },

  logout: async () => {
    const rt = localStorage.getItem('refreshToken')
    if (rt) {
      try { await api.post('/auth/logout', { refreshToken: rt }) } catch {}
    }
    localStorage.removeItem('refreshToken')
    set({ user: null, org: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false })
  },

  refreshAuth: async () => {
    const rt = localStorage.getItem('refreshToken')
    if (!rt) {
      set({ isLoading: false })
      return
    }
    try {
      const { data } = await api.post('/auth/refresh', { refreshToken: rt })
      set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      })
      localStorage.setItem('refreshToken', data.refreshToken)
      return data.accessToken
    } catch {
      localStorage.removeItem('refreshToken')
      set({ isAuthenticated: false, isLoading: false })
    }
  },

  setUser: (user, org) => set({ user, org }),
}))

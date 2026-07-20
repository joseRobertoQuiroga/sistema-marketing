import { io } from 'socket.io-client'
import { API_URL } from './api'

let instance = null

export function connectSocket(token) {
  if (instance?.connected) return instance
  instance = io(API_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  })
  return instance
}

export function disconnectSocket() {
  if (instance) {
    instance.disconnect()
    instance = null
  }
}

export function getSocket() {
  return instance
}

export default instance

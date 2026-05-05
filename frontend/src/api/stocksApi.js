import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

const client = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
})

export const stocksApi = {
  list:        ()                   => client.get('/stocks'),
  get:         (symbol)             => client.get(`/stocks/${symbol}`),
  history:     (symbol, hours = 24) => client.get(`/stocks/${symbol}/history?hours=${hours}`),
  aggregates:  (symbol, days = 30)  => client.get(`/stocks/${symbol}/aggregates?days=${days}`),
  alerts:      (symbol)             => client.get(`/stocks/${symbol}/alerts`),
  createAlert: (symbol, data)       => client.post(`/stocks/${symbol}/alerts`, data),
}

export default client

// src/api/client.js
import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

const client = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
})

export const stocksApi = {
  list:        ()                     => client.get('/stocks'),
  get:         (symbol)               => client.get(`/stocks/${symbol}`),
  history:     (symbol, hours = 24)   => client.get(`/stocks/${symbol}/history?hours=${hours}`),
  aggregates:  (symbol, days = 30)    => client.get(`/stocks/${symbol}/aggregates?days=${days}`),
  alerts:      (symbol)               => client.get(`/stocks/${symbol}/alerts`),
  createAlert: (symbol, data)         => client.post(`/stocks/${symbol}/alerts`, data),
}

export default client


// src/hooks/usePolling.js
import { useEffect, useRef } from 'react'

export function usePolling(fn, intervalMs = 30000, enabled = true) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => fnRef.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])
}


// src/hooks/useStockList.js
import { useState, useEffect, useCallback } from 'react'
import { stocksApi } from '../api/client'
import { usePolling } from './usePolling'

const FALLBACK = [
  { symbol:'AAPL',  name:'Apple Inc.',          sector:'Technology', price:189.42, change:2.18,   change_pct:1.16,  volume:48291042, last_updated:'2024-11-20T20:00:00Z' },
  { symbol:'MSFT',  name:'Microsoft Corp.',     sector:'Technology', price:374.12, change:-1.88,  change_pct:-0.50, volume:22184300, last_updated:'2024-11-20T20:00:00Z' },
  { symbol:'GOOGL', name:'Alphabet Inc.',       sector:'Technology', price:140.28, change:0.68,   change_pct:0.49,  volume:19841200, last_updated:'2024-11-20T20:00:00Z' },
  { symbol:'AMZN',  name:'Amazon.com Inc.',     sector:'Consumer',   price:187.54, change:3.14,   change_pct:1.70,  volume:31204800, last_updated:'2024-11-20T20:00:00Z' },
  { symbol:'NVDA',  name:'NVIDIA Corp.',        sector:'Technology', price:496.32, change:8.52,   change_pct:1.75,  volume:41892100, last_updated:'2024-11-20T20:00:00Z' },
  { symbol:'META',  name:'Meta Platforms Inc.', sector:'Technology', price:503.28, change:-4.12,  change_pct:-0.81, volume:18204100, last_updated:'2024-11-20T20:00:00Z' },
  { symbol:'TSLA',  name:'Tesla Inc.',          sector:'Automotive', price:227.84, change:-3.42,  change_pct:-1.48, volume:82194300, last_updated:'2024-11-20T20:00:00Z' },
  { symbol:'JPM',   name:'JPMorgan Chase',      sector:'Financials', price:200.14, change:1.24,   change_pct:0.62,  volume:12084200, last_updated:'2024-11-20T20:00:00Z' },
]

export function useStockList() {
  const [stocks,  setStocks]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [mock,    setMock]    = useState(false)

  const fetch = useCallback(async () => {
    try {
      const r = await stocksApi.list()
      setStocks(r.data.stocks || [])
      setMock(false)
    } catch {
      setStocks(FALLBACK)
      setMock(true)
      setError('API unavailable — showing demo data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])
  usePolling(fetch, 30000)

  return { stocks, loading, error, mock, refresh: fetch }
}


// src/hooks/useStockDetail.js
import { useState, useEffect, useCallback } from 'react'
import { stocksApi } from '../api/client'
import { usePolling } from './usePolling'

export function useStockDetail(symbol, historyHours = 24) {
  const [detail,  setDetail]  = useState(null)
  const [history, setHistory] = useState([])
  const [aggs,    setAggs]    = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!symbol) return
    try {
      const [detRes, histRes, aggRes] = await Promise.allSettled([
        stocksApi.get(symbol),
        stocksApi.history(symbol, historyHours),
        stocksApi.aggregates(symbol, 30),
      ])
      if (detRes.status  === 'fulfilled') setDetail(detRes.value.data)
      if (histRes.status === 'fulfilled') setHistory(histRes.value.data.history || [])
      if (aggRes.status  === 'fulfilled') setAggs(aggRes.value.data.aggregates || [])
    } catch {
      // fallback handled per component
    } finally {
      setLoading(false)
    }
  }, [symbol, historyHours])

  useEffect(() => { fetch() }, [fetch])
  usePolling(fetch, 30000)

  return { detail, history, aggs, loading, refresh: fetch }
}

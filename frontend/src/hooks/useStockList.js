import { useState, useEffect, useCallback } from 'react'
import { stocksApi } from '../api/stocksApi'
import { usePolling } from './usePolling'

const FALLBACK = [
  { symbol:'AAPL',  name:'Apple Inc.',           sector:'Technology', price:189.42, change:2.18,  change_pct:1.16,  volume:48291042 },
  { symbol:'MSFT',  name:'Microsoft Corp.',      sector:'Technology', price:374.12, change:-1.88, change_pct:-0.50, volume:22184300 },
  { symbol:'GOOGL', name:'Alphabet Inc.',        sector:'Technology', price:140.28, change:0.68,  change_pct:0.49,  volume:19841200 },
  { symbol:'AMZN',  name:'Amazon.com Inc.',      sector:'Consumer',   price:187.54, change:3.14,  change_pct:1.70,  volume:31204800 },
  { symbol:'NVDA',  name:'NVIDIA Corp.',         sector:'Technology', price:496.32, change:8.52,  change_pct:1.75,  volume:41892100 },
  { symbol:'META',  name:'Meta Platforms Inc.',  sector:'Technology', price:503.28, change:-4.12, change_pct:-0.81, volume:18204100 },
  { symbol:'TSLA',  name:'Tesla Inc.',           sector:'Automotive', price:227.84, change:-3.42, change_pct:-1.48, volume:82194300 },
  { symbol:'JPM',   name:'JPMorgan Chase',       sector:'Financials', price:200.14, change:1.24,  change_pct:0.62,  volume:12084200 },
  { symbol:'GS',    name:'Goldman Sachs',        sector:'Financials', price:494.22, change:-2.18, change_pct:-0.44, volume:4128400  },
  { symbol:'BAC',   name:'Bank of America',      sector:'Financials', price:39.08,  change:0.22,  change_pct:0.57,  volume:38291000 },
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
      setMock(false); setError(null)
    } catch {
      setStocks(FALLBACK)
      setMock(true)
      setError('Lambda API not reachable — demo data shown')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])
  usePolling(fetch, 30000)

  return { stocks, loading, error, mock, refresh: fetch }
}

import { useState, useEffect, useCallback } from 'react'
import { stocksApi } from '../api/stocksApi'
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
      if (aggRes.status  === 'fulfilled') setAggs(aggRes.value.data.aggregates   || [])
    } catch {
      // errors are silent — demo data shown via empty arrays
    } finally {
      setLoading(false)
    }
  }, [symbol, historyHours])

  useEffect(() => { fetch() }, [fetch])
  usePolling(fetch, 30000)

  return { detail, history, aggs, loading, refresh: fetch }
}

// src/components/TopBar.jsx
import { useState, useEffect } from 'react'
import { useStockList } from '../hooks/useStockList'

// ── Rolling ticker strip ─────────────────────────────────────────────────────
function TickerStrip({ stocks }) {
  if (!stocks.length) return null
  const items = [...stocks, ...stocks] // duplicate for seamless loop

  return (
    <div style={{
      overflow: 'hidden', flex: 1, position: 'relative',
      maskImage: 'linear-gradient(to right, transparent, black 60px, black calc(100% - 60px), transparent)',
    }}>
      <div style={{
        display: 'flex', gap: 32, whiteSpace: 'nowrap',
        animation: `ticker ${stocks.length * 4}s linear infinite`,
      }}>
        {items.map((s, i) => {
          const up = s.change_pct >= 0
          return (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--font-mono)', fontSize: 11,
            }}>
              <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{s.symbol}</span>
              <span style={{ color: 'var(--text)' }}>${Number(s.price).toFixed(2)}</span>
              <span style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                {up ? '▲' : '▼'} {Math.abs(s.change_pct).toFixed(2)}%
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default function TopBar() {
  const { stocks, mock } = useStockList()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const isMarketOpen = (() => {
    const h = time.getUTCHours(), m = time.getUTCMinutes()
    const min = h * 60 + m
    const day = time.getUTCDay()
    return day >= 1 && day <= 5 && min >= 13 * 60 + 30 && min < 20 * 60
  })()

  return (
    <header style={{
      height: 40, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 16px', flexShrink: 0,
    }}>
      {/* Market status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span className={isMarketOpen ? 'live-dot' : ''} style={!isMarketOpen ? {
          width: 6, height: 6, borderRadius: '50%', background: 'var(--text3)', display: 'inline-block'
        } : {}} />
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: isMarketOpen ? 'var(--green)' : 'var(--text3)' }}>
          {isMarketOpen ? 'MKT OPEN' : 'MKT CLOSED'}
        </span>
        <span style={{ width: 1, height: 12, background: 'var(--border2)' }} />
      </div>

      {/* Ticker */}
      <TickerStrip stocks={stocks} />

      {/* Right: time + mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {mock && (
          <span className="badge badge-amber" style={{ fontSize: 9 }}>DEMO</span>
        )}
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
          {time.toUTCString().slice(17, 25)} UTC
        </span>
      </div>
    </header>
  )
}

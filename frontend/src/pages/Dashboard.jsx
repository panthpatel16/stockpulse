// src/pages/Dashboard.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStockList } from '../hooks/useStockList'

function ChangeCell({ change, change_pct }) {
  const up = change_pct >= 0
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 12,
      color: up ? 'var(--green)' : 'var(--red)',
    }}>
      {up ? '+' : ''}{Number(change).toFixed(2)}&nbsp;
      <span style={{ opacity: 0.7 }}>({up ? '+' : ''}{Number(change_pct).toFixed(2)}%)</span>
    </span>
  )
}

const SECTORS = ['All', 'Technology', 'Financials', 'Consumer', 'Automotive']

export default function Dashboard() {
  const navigate = useNavigate()
  const { stocks, loading, error, mock } = useStockList()
  const [sector,  setSector]  = useState('All')
  const [search,  setSearch]  = useState('')
  const [sortKey, setSortKey] = useState('symbol')
  const [sortAsc, setSortAsc] = useState(true)

  const filtered = stocks
    .filter(s => sector === 'All' || s.sector === sector)
    .filter(s =>
      s.symbol.toLowerCase().includes(search.toLowerCase()) ||
      (s.name || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return sortAsc ? cmp : -cmp
    })

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(p => !p)
    else { setSortKey(key); setSortAsc(true) }
  }

  const SortHeader = ({ label, k, style }) => (
    <span
      onClick={() => toggleSort(k)}
      style={{
        cursor: 'pointer', userSelect: 'none', fontFamily: 'var(--font-mono)',
        fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase',
        color: sortKey === k ? 'var(--green)' : 'var(--text3)',
        transition: 'color .15s', ...style,
      }}
    >
      {label} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
    </span>
  )

  // Summary stats
  const gainers  = stocks.filter(s => s.change_pct > 0).length
  const losers   = stocks.filter(s => s.change_pct < 0).length
  const avgChange = stocks.length
    ? (stocks.reduce((s, x) => s + (x.change_pct || 0), 0) / stocks.length).toFixed(2)
    : '0'

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>

      {/* Header */}
      <div className="anim-fade-up" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22,
      }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600,
            color: 'var(--text)', letterSpacing: '-0.01em',
          }}>
            MARKET OVERVIEW
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
            {stocks.length} symbols tracked · refreshes every 30s
          </p>
        </div>
        {mock && (
          <div style={{
            padding: '6px 12px', background: 'var(--amber-dim)',
            border: '1px solid rgba(255,165,0,.2)', borderRadius: 'var(--radius-sm)',
            fontSize: 10, color: 'var(--amber)', fontFamily: 'var(--font-mono)',
          }}>
            ⚠ DEMO MODE — Lambda API not connected
          </div>
        )}
      </div>

      {/* Summary strip */}
      <div className="anim-fade-up anim-d1" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20,
      }}>
        {[
          { label: 'TRACKED',   value: stocks.length,    unit: 'symbols' },
          { label: 'ADVANCING', value: gainers,           unit: 'stocks', color: 'var(--green)' },
          { label: 'DECLINING', value: losers,            unit: 'stocks', color: 'var(--red)'   },
          { label: 'AVG MOVE',  value: `${avgChange > 0 ? '+' : ''}${avgChange}%`, color: parseFloat(avgChange) >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px' }}>
            <div className="label" style={{ marginBottom: 6 }}>{s.label}</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600,
              color: s.color || 'var(--text)', letterSpacing: '-0.02em',
            }}>
              {s.value}
              {s.unit && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 5 }}>{s.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="anim-fade-up anim-d2" style={{
        display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          className="input"
          placeholder="Search symbol or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 220 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {SECTORS.map(sec => (
            <button
              key={sec}
              onClick={() => setSector(sec)}
              style={{
                padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid',
                borderColor: sector === sec ? 'var(--green)' : 'var(--border)',
                background:  sector === sec ? 'var(--green-dim)' : 'transparent',
                color:       sector === sec ? 'var(--green)' : 'var(--text3)',
                fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '.05em', transition: 'all .15s',
              }}
            >{sec}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="anim-fade-up anim-d3 card">
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '80px 1fr 110px 160px 120px 80px',
          padding: '9px 18px',
          background: 'var(--surface2)',
          borderBottom: '1px solid var(--border)',
          borderRadius: 'var(--radius) var(--radius) 0 0',
          gap: 8,
        }}>
          <SortHeader label="Symbol"  k="symbol" />
          <SortHeader label="Name"    k="name" />
          <SortHeader label="Price"   k="price"      style={{ textAlign: 'right' }} />
          <SortHeader label="Change"  k="change_pct" style={{ textAlign: 'right' }} />
          <SortHeader label="Volume"  k="volume"     style={{ textAlign: 'right' }} />
          <span className="label" style={{ textAlign: 'right' }}>Sector</span>
        </div>

        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, gap:10 }}>
            <span className="spinner" />
            <span style={{ color:'var(--text3)', fontFamily:'var(--font-mono)', fontSize:11 }}>LOADING MARKET DATA...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:48, textAlign:'center', color:'var(--text3)', fontFamily:'var(--font-mono)', fontSize:11 }}>
            NO RESULTS
          </div>
        ) : (
          filtered.map((s, i) => {
            const up = s.change_pct >= 0
            return (
              <div
                key={s.symbol}
                className="trow"
                onClick={() => navigate(`/stocks/${s.symbol}`)}
                style={{
                  gridTemplateColumns: '80px 1fr 110px 160px 120px 80px',
                  gap: 8,
                  animationDelay: `${i * 0.02}s`,
                }}
              >
                {/* Symbol */}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
                  color: 'var(--text)', letterSpacing: '.02em',
                }}>{s.symbol}</span>

                {/* Name */}
                <span style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </span>

                {/* Price */}
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>
                  ${s.price != null ? Number(s.price).toFixed(2) : '—'}
                </span>

                {/* Change */}
                <div style={{ textAlign: 'right' }}>
                  <ChangeCell change={s.change || 0} change_pct={s.change_pct || 0} />
                </div>

                {/* Volume */}
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
                  {s.volume != null ? (s.volume >= 1_000_000 ? `${(s.volume/1_000_000).toFixed(1)}M` : `${(s.volume/1000).toFixed(0)}K`) : '—'}
                </span>

                {/* Sector badge */}
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-dim" style={{ fontSize: 9 }}>
                    {s.sector || '—'}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 14, fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
        Data ingested via AWS Lambda → DynamoDB · Serverless · $0 idle cost
      </div>
    </div>
  )
}

// src/pages/StockDetail.jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStockDetail } from '../hooks/useStockDetail'
import { PriceChart } from '../components/charts/Charts'
import { VolumeBar } from '../components/charts/Charts'
import { stocksApi } from '../api/stocksApi'

const RANGES = [
  { label: '1H',  hours: 1  },
  { label: '6H',  hours: 6  },
  { label: '1D',  hours: 24 },
  { label: '5D',  hours: 120 },
]

function StatBox({ label, value, sub, color }) {
  return (
    <div style={{ padding: '12px 16px' }}>
      <div className="label" style={{ marginBottom: 5 }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600,
        color: color || 'var(--text)', letterSpacing: '-0.01em',
      }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{sub}</div>}
    </div>
  )
}

function AlertForm({ symbol, onCreated }) {
  const [email,  setEmail]  = useState('')
  const [price,  setPrice]  = useState('')
  const [dir,    setDir]    = useState('above')
  const [loading, setLoading] = useState(false)
  const [msg,    setMsg]    = useState('')

  const submit = async () => {
    if (!email || !price) { setMsg('Email and price required'); return }
    setLoading(true); setMsg('')
    try {
      await stocksApi.createAlert(symbol, { email, target_price: parseFloat(price), direction: dir })
      setMsg('Alert created ✓')
      setEmail(''); setPrice('')
    } catch {
      setMsg('Error creating alert')
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '16px 18px' }}>
      <div className="label" style={{ marginBottom: 12 }}>SET PRICE ALERT</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 160px' }}>
          <div className="label" style={{ marginBottom: 5 }}>EMAIL</div>
          <input className="input" type="email" placeholder="you@example.com"
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ flex: '0 0 120px' }}>
          <div className="label" style={{ marginBottom: 5 }}>TARGET PRICE</div>
          <input className="input" type="number" placeholder="0.00"
            value={price} onChange={e => setPrice(e.target.value)} />
        </div>
        <div style={{ flex: '0 0 120px' }}>
          <div className="label" style={{ marginBottom: 5 }}>DIRECTION</div>
          <select value={dir} onChange={e => setDir(e.target.value)} style={{
            width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
            borderRadius: 'var(--radius-sm)', padding: '8px 10px', color: 'var(--text)',
            fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none',
          }}>
            <option value="above">ABOVE</option>
            <option value="below">BELOW</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={submit} disabled={loading} style={{ marginBottom: 1 }}>
          {loading ? <span className="spinner" /> : 'SET ALERT'}
        </button>
      </div>
      {msg && (
        <div style={{
          marginTop: 10, fontSize: 11, fontFamily: 'var(--font-mono)',
          color: msg.includes('✓') ? 'var(--green)' : 'var(--red)',
        }}>{msg}</div>
      )}
    </div>
  )
}

export default function StockDetail() {
  const { symbol }  = useParams()
  const navigate    = useNavigate()
  const [range, setRange] = useState(RANGES[2]) // default 1D

  const { detail, history, aggs, loading } = useStockDetail(symbol.toUpperCase(), range.hours)

  const up = detail ? detail.change_pct >= 0 : true
  const accentColor = up ? 'var(--green)' : 'var(--red)'

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>

      {/* Back nav */}
      <button
        onClick={() => navigate('/dashboard')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 11,
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18,
          padding: 0, transition: 'color .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
      >
        ← MARKET OVERVIEW
      </button>

      {loading && !detail ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, gap:10 }}>
          <span className="spinner" />
          <span style={{ color:'var(--text3)', fontFamily:'var(--font-mono)', fontSize:11 }}>LOADING {symbol}...</span>
        </div>
      ) : (
        <>
          {/* Symbol header */}
          <div className="anim-fade-up" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 4 }}>
                <h1 style={{
                  fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600,
                  letterSpacing: '-0.02em', color: 'var(--text)',
                }}>{symbol.toUpperCase()}</h1>
                {detail?.name && (
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>{detail.name}</span>
                )}
                {detail?.sector && (
                  <span className="badge badge-dim" style={{ fontSize: 9 }}>{detail.sector}</span>
                )}
              </div>

              {/* Price + change */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 600,
                  letterSpacing: '-0.03em', color: 'var(--text)',
                }}>
                  ${detail?.price != null ? Number(detail.price).toFixed(2) : '—'}
                </span>
                {detail?.change != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: accentColor }}>
                    {up ? '+' : ''}{Number(detail.change).toFixed(2)}
                    <span style={{ opacity: 0.7, marginLeft: 6 }}>
                      ({up ? '+' : ''}{Number(detail.change_pct).toFixed(2)}%)
                    </span>
                  </span>
                )}
              </div>
            </div>

            {detail?.last_updated && (
              <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                <div style={{ marginBottom: 4 }}>LAST UPDATED</div>
                <div>{new Date(detail.last_updated).toUTCString().slice(5, 25)} UTC</div>
              </div>
            )}
          </div>

          {/* Stat strip */}
          <div className="anim-fade-up anim-d1 card" style={{
            display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 16,
            borderBottom: '1px solid var(--border)',
          }}>
            <StatBox label="OPEN"       value={detail?.open != null  ? `$${Number(detail.open).toFixed(2)}`  : '—'} />
            <StatBox label="HIGH"       value={detail?.high != null  ? `$${Number(detail.high).toFixed(2)}`  : '—'} color="var(--green)" />
            <StatBox label="LOW"        value={detail?.low  != null  ? `$${Number(detail.low).toFixed(2)}`   : '—'} color="var(--red)" />
            <StatBox label="VOLUME"     value={detail?.volume != null ? (detail.volume >= 1_000_000 ? `${(detail.volume/1_000_000).toFixed(1)}M` : `${(detail.volume/1000).toFixed(0)}K`) : '—'} />
            <StatBox label="52W HIGH"   value={detail?.high_52w != null ? `$${Number(detail.high_52w).toFixed(2)}`  : '—'} />
            <StatBox label="52W LOW"    value={detail?.low_52w  != null ? `$${Number(detail.low_52w).toFixed(2)}`   : '—'} />
          </div>

          {/* Price chart */}
          <div className="anim-fade-up anim-d2 card" style={{ marginBottom: 16 }}>
            <div style={{
              padding: '14px 18px 10px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                PRICE — INTRADAY
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {RANGES.map(r => (
                  <button
                    key={r.label}
                    onClick={() => setRange(r)}
                    style={{
                      padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid',
                      borderColor: range.label === r.label ? accentColor : 'var(--border)',
                      background:  range.label === r.label ? (up ? 'var(--green-dim)' : 'var(--red-dim)') : 'transparent',
                      color:       range.label === r.label ? accentColor : 'var(--text3)',
                      fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all .15s',
                    }}
                  >{r.label}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: '12px 4px 4px' }}>
              <PriceChart data={history} height={220} />
            </div>
            <div style={{ padding: '0 4px 8px' }}>
              <VolumeBar data={history} height={60} />
            </div>
          </div>

          {/* Moving averages */}
          {aggs.length > 0 && (
            <div className="anim-fade-up anim-d3 card" style={{ marginBottom: 16 }}>
              <div style={{
                padding: '12px 18px',
                borderBottom: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)',
                textTransform: 'uppercase', letterSpacing: '.06em',
              }}>
                DAILY AGGREGATES — 30D
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {(() => {
                  const latest = aggs[aggs.length - 1]
                  return [
                    { label: 'DAILY VWAP', value: latest?.vwap  ? `$${Number(latest.vwap).toFixed(2)}`  : '—' },
                    { label: '20D MA',     value: latest?.ma20   ? `$${Number(latest.ma20).toFixed(2)}`  : '—' },
                    { label: '50D MA',     value: latest?.ma50   ? `$${Number(latest.ma50).toFixed(2)}`  : '—' },
                  ].map((s, i) => (
                    <div key={i} style={{
                      padding: '14px 18px',
                      borderRight: i < 2 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div className="label" style={{ marginBottom: 5 }}>{s.label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--cyan)' }}>
                        {s.value}
                      </div>
                    </div>
                  ))
                })()}
              </div>
              {/* Daily close chart using aggregates */}
              <div style={{ padding: '8px 4px 8px' }}>
                <PriceChart data={aggs.map(a => ({ ...a, timestamp: a.date + 'T16:00:00Z', close: a.close }))} height={140} showDates />
              </div>
            </div>
          )}

          {/* Price alert form */}
          <div className="anim-fade-up anim-d4 card">
            <AlertForm symbol={symbol.toUpperCase()} />
          </div>
        </>
      )}
    </div>
  )
}

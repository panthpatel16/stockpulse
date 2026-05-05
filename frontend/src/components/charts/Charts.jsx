// src/components/charts/PriceChart.jsx
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts'

const fmt = {
  time: (t) => {
    if (!t) return ''
    const d = new Date(t)
    return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`
  },
  date: (t) => {
    if (!t) return ''
    const d = new Date(t)
    return `${d.getUTCMonth()+1}/${d.getUTCDate()}`
  },
}

const TTStyle = {
  contentStyle: {
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)',
    boxShadow: '0 4px 20px rgba(0,0,0,.6)',
  },
  labelStyle: { color: 'var(--text2)', marginBottom: 3 },
  cursor: { stroke: 'var(--border2)', strokeWidth: 1, strokeDasharray: '3 3' },
}

export function PriceChart({ data = [], height = 200, showDates = false }) {
  if (!data.length) return (
    <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontFamily:'var(--font-mono)', fontSize:11 }}>
      NO DATA
    </div>
  )

  const prices = data.map(d => d.close || 0).filter(Boolean)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const mid  = ((minP + maxP) / 2).toFixed(2)
  const isUp = data.length > 1 && (data[data.length-1].close || 0) >= (data[0].close || 0)
  const color = isUp ? 'var(--green)' : 'var(--red)'
  const gradId = `grad-${isUp ? 'g' : 'r'}`

  const series = data.map(d => ({
    t:     d.timestamp,
    price: d.close,
    high:  d.high,
    low:   d.low,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={isUp ? '#00ff87' : '#ff3b5c'} stopOpacity={0.18} />
            <stop offset="100%" stopColor={isUp ? '#00ff87' : '#ff3b5c'} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="t" tickFormatter={showDates ? fmt.date : fmt.time}
          tick={{ fill:'var(--text3)', fontSize:9, fontFamily:'var(--font-mono)' }}
          tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis domain={['auto','auto']} tickFormatter={v => `$${v.toFixed(0)}`}
          tick={{ fill:'var(--text3)', fontSize:9, fontFamily:'var(--font-mono)' }}
          tickLine={false} axisLine={false} width={48} />
        <ReferenceLine y={parseFloat(mid)} stroke="var(--border2)" strokeDasharray="2 4" />
        <Tooltip {...TTStyle} formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Price']}
          labelFormatter={t => showDates ? fmt.date(t) : fmt.time(t)} />
        <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.5}
          fill={`url(#${gradId})`} dot={false}
          activeDot={{ r:3, fill:color, strokeWidth:0 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}


export function VolumeBar({ data = [], height = 80 }) {
  if (!data.length) return null
  const series = data.map(d => ({
    t: d.timestamp || d.date,
    v: d.volume || 0,
  }))
  const fmt = v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={series} margin={{ top:0, right:4, left:0, bottom:0 }} barSize={3}>
        <XAxis dataKey="t" hide />
        <YAxis tickFormatter={fmt} tick={{ fill:'var(--text3)', fontSize:9, fontFamily:'var(--font-mono)' }}
          tickLine={false} axisLine={false} width={36} />
        <Tooltip
          contentStyle={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:4, fontFamily:'var(--font-mono)', fontSize:11 }}
          formatter={v => [fmt(v), 'Vol']}
          labelFormatter={() => ''}
          cursor={{ fill:'rgba(255,255,255,0.03)' }}
        />
        <Bar dataKey="v" fill="#1c9eff" opacity={0.7} radius={[1,1,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

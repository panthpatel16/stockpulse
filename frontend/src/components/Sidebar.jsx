// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/dashboard', label: 'Market' },
  { to: '/watchlist', label: 'Watchlist' },
]

export default function Sidebar() {
  return (
    <aside style={{
      width: 56, background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '16px 0', flexShrink: 0, gap: 4,
    }}>
      {/* Logo mark */}
      <div style={{
        width: 32, height: 32, borderRadius: 4,
        background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: '#000',
        marginBottom: 16, letterSpacing: '-0.04em',
      }}>SP</div>

      {[
        { to: '/dashboard', icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
        ), label: 'Market' },
      ].map(item => (
        <NavLink key={item.to} to={item.to} title={item.label} style={({ isActive }) => ({
          width: 40, height: 40, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color:       isActive ? 'var(--green)' : 'var(--text3)',
          background:  isActive ? 'var(--green-dim)' : 'transparent',
          border:      isActive ? '1px solid rgba(0,255,135,.15)' : '1px solid transparent',
          transition: 'all .15s', textDecoration: 'none',
        })}>
          {item.icon}
        </NavLink>
      ))}
    </aside>
  )
}

import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Activity, BarChart3, Boxes, ChevronRight, Cpu, Database, Gauge, Github, LayoutDashboard, Menu, Network, PanelLeft, Radio, Settings2, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { useSimulationStore } from '../../stores/simulationStore'
import { useSettingsStore } from '../../stores/settingsStore'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/simulator', label: 'Simulations', icon: Radio },
  { to: '/events', label: 'Event ledger', icon: Database },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/architecture', label: 'Architecture', icon: Network },
  { to: '/limitations', label: 'Limitations', icon: SlidersHorizontal },
]

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const status = useSimulationStore((state) => state.status)
  const scenario = useSimulationStore((state) => state.scenario)
  const debugMode = useSettingsStore((state) => state.debugMode)
  const setSettings = useSettingsStore((state) => state.set)
  const isActiveSimulation = location.pathname.startsWith('/simulation/')
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand" onClick={() => navigate('/')} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') navigate('/') }}>
        <div className="brand-mark"><ShieldCheck size={18} strokeWidth={2.5} /></div>
        <div><div className="brand-name">Shop<span>OnGo</span></div><div className="brand-sub">Retail intelligence lab</div></div>
      </div>
      <div className="side-section-label">Workspace</div>
      <nav className="side-nav" aria-label="Primary navigation">
        {links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`} onClick={() => setMobileOpen(false)}><Icon size={16} /><span>{label}</span>{label === 'Simulations' && status === 'RUNNING' && <i className="nav-live-dot" />}</NavLink>)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="side-lab-card">
        <div className="lab-icon"><Cpu size={16} /></div>
        <div><strong>Simulation mode</strong><span>Providers are local & deterministic</span></div>
        <div className="tiny-online"><i /> online</div>
      </div>
      <div className="sidebar-footer"><span><span className="status-dot green" /> v0.9.0 prototype</span><button className="icon-button subtle" aria-label="Open settings" onClick={() => setSettings({ debugMode: !debugMode })}><Settings2 size={15} /></button></div>
    </aside>
    {mobileOpen && <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} />}
    <main className="main-shell">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={18} /></button><div className="breadcrumb"><span>ShopOnGo</span><ChevronRight size={14} /><strong>{isActiveSimulation ? scenario.name : links.find((link) => location.pathname.startsWith(link.to))?.label ?? 'Overview'}</strong></div></div>
        <div className="topbar-actions"><div className="simulation-chip"><span className={`status-dot ${status === 'RUNNING' ? 'cyan pulse' : status === 'COMPLETE' ? 'green' : 'amber'}`} /> <span>{status === 'RUNNING' ? 'Live simulation' : status === 'COMPLETE' ? 'Run complete' : 'System ready'}</span></div><button className="avatar" aria-label="Operator account">OP</button></div>
      </header>
      {debugMode && <div className="debug-banner"><span><Gauge size={14} /> Developer mode enabled — raw evidence and operator triggers are visible.</span><button onClick={() => setSettings({ debugMode: false })}><X size={14} /></button></div>}
      <div className="page-content"><Outlet /></div>
    </main>
  </div>
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-header-action">{action}</div>}</div>
}

export function SectionHeading({ label, detail, action }: { label: string; detail?: string; action?: React.ReactNode }) { return <div className="section-heading"><div><h2>{label}</h2>{detail && <span>{detail}</span>}</div>{action}</div> }

import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { LandingPage } from '../pages/LandingPage'
import { DashboardPage } from '../pages/DashboardPage'
import { SimulatorPage } from '../pages/SimulatorPage'
import { ActiveSimulationPage } from '../pages/ActiveSimulationPage'
import { EventsPage } from '../pages/EventsPage'
import { AnalyticsPage } from '../pages/AnalyticsPage'
import { ArchitecturePage } from '../pages/ArchitecturePage'
import { LimitationsPage } from '../pages/LimitationsPage'
import { useSimulationStore } from '../stores/simulationStore'

function SimulationTicker() {
  const status = useSimulationStore((state) => state.status)
  const tick = useSimulationStore((state) => state.tick)
  useEffect(() => { if (status !== 'RUNNING') return; let previous = performance.now(); const timer = window.setInterval(() => { const now = performance.now(); const delta = Math.min(250, now - previous); previous = now; if (!document.hidden) tick(delta) }, 100); return () => window.clearInterval(timer) }, [status, tick])
  return null
}
export function App() { return <BrowserRouter><SimulationTicker /><Routes><Route path="/" element={<LandingPage />} /><Route element={<AppShell />}><Route path="/dashboard" element={<DashboardPage />} /><Route path="/simulator" element={<SimulatorPage />} /><Route path="/simulation/:scenarioId" element={<ActiveSimulationPage />} /><Route path="/events" element={<EventsPage />} /><Route path="/analytics" element={<AnalyticsPage />} /><Route path="/architecture" element={<ArchitecturePage />} /><Route path="/limitations" element={<LimitationsPage />} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Route></Routes></BrowserRouter> }

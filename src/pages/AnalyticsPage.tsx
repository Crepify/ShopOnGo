import { Activity, AlertTriangle, BarChart3, Camera, CheckCircle2, Clock3, Gauge, Radio, ShieldAlert, Users } from 'lucide-react'
import { PageHeader, SectionHeading } from '../components/layout/AppShell'
import { MetricCard } from '../components/common/MetricCard'
import { journeyCount, latencyData, meanConfidence, reviewRate, scenarioMetricData, scenarioPassRate, statusData } from '../data/metrics'

const colors = ['#50e4b2', '#e9ae60', '#e86f80', '#9a81ed']

export function AnalyticsPage() {
  return <div className="page analytics-page"><PageHeader eyebrow="Measurement layer" title="Simulation analytics" description="A transparent sandbox for understanding how the reconciliation loop behaves across deterministic journeys." action={<span className="simulation-only-badge"><Activity size={13} /> simulation metrics — not production performance</span>} /><div className="metric-grid analytics-metrics"><MetricCard label="Scenario pass rate" value={`${scenarioPassRate}%`} detail={`across ${journeyCount} replayable journeys`} icon={CheckCircle2} tone="green" /><MetricCard label="Mean confidence" value={`${meanConfidence}%`} detail="replayed evidence score" icon={Gauge} tone="cyan" /><MetricCard label="Review rate" value={`${reviewRate}%`} detail="human-review paths" icon={Users} tone="purple" /><MetricCard label="Sensor uptime" value="99.1%" detail="simulated provider health" icon={Radio} tone="amber" /></div><div className="analytics-grid"><div className="chart-card large"><SectionHeading label="Scenario outcome quality" detail="Expected safety path observed · replayed" /><div className="chart-legend"><span><i className="legend-box green" /> pass path</span><span><i className="legend-box cyan" /> mean confidence</span></div><div className="chart-area"><ScenarioChart /></div></div><div className="chart-card"><SectionHeading label="Result distribution" detail={`${journeyCount} deterministic journeys`} /><div className="donut-wrap"><DonutChart /></div><div className="donut-legend">{statusData.map((item, index) => <div key={item.name}><i style={{ background: colors[index] }} /><span>{item.name}</span><strong>{item.value}%</strong></div>)}</div></div><div className="chart-card large"><SectionHeading label="Event processing latency" detail="Milliseconds · simulated local event loop" /><div className="chart-area"><LatencyChart /></div></div><div className="analytics-health"><SectionHeading label="Provider health" detail="Replacement-ready adapters · operational telemetry" /><HealthRow icon={Camera} label="Vision simulator" value="100%" detail="3 active camera zones" tone="green" /><HealthRow icon={Radio} label="Shelf simulator" value="99.1%" detail="4 active shelf zones" tone="green" /><HealthRow icon={Clock3} label="Event ordering" value="96.8%" detail="grace-period reconciled" tone="cyan" /><HealthRow icon={ShieldAlert} label="Human review" value="18.4%" detail="safe escalation path" tone="amber" /></div><div className="analytics-note"><AlertTriangle size={15} /><p>These metrics are generated from deterministic software events and should not be interpreted as real-world detection accuracy, loss-prevention performance, or payment authorization data.</p></div></div></div>
}

function ScenarioChart() {
  const chartWidth = 820
  const chartHeight = 220
  const barWidth = Math.max(10, (chartWidth - 40) / scenarioMetricData.length / 2.5)
  return <svg className="analytics-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Scenario pass and confidence chart"><GridLines width={chartWidth} height={chartHeight} /><g>{scenarioMetricData.map((entry, index) => { const x = 30 + index * ((chartWidth - 50) / scenarioMetricData.length); const passHeight = entry.pass * 1.55; const confidenceHeight = entry.confidence * 1.55; return <g key={entry.name}><rect x={x} y={190 - passHeight} width={barWidth} height={passHeight} rx="3" fill="#50e4b2" opacity=".86" /><rect x={x + barWidth + 3} y={190 - confidenceHeight} width={barWidth} height={confidenceHeight} rx="3" fill="#37c8db" opacity=".86" /><text x={x + barWidth} y="207" textAnchor="middle">{entry.name}</text></g> })}</g></svg>
}

function LatencyChart() {
  const width = 820
  const height = 220
  const points = latencyData.map((entry, index) => `${35 + index * ((width - 70) / (latencyData.length - 1))},${190 - (entry.latency - 60) * 1.65}`).join(' ')
  return <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Event processing latency chart"><GridLines width={width} height={height} /><polyline points={points} fill="none" stroke="#58dbe7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{latencyData.map((entry, index) => { const x = 35 + index * ((width - 70) / (latencyData.length - 1)); const y = 190 - (entry.latency - 60) * 1.65; return <g key={entry.time}><circle cx={x} cy={y} r="4" fill="#58dbe7" stroke="#0b1d2b" strokeWidth="2" /><text x={x} y="207" textAnchor="middle">{entry.time}</text></g> })}</svg>
}

function GridLines({ width, height }: { width: number; height: number }) { return <g className="analytics-grid-lines">{[30, 70, 110, 150, 190].map((y) => <line key={y} x1="30" x2={width - 20} y1={y} y2={y} />)}<line x1="30" x2="30" y1="20" y2={height - 30} /></g> }

function DonutChart() {
  let offset = 0
  const circumference = 2 * Math.PI * 58
  return <div className="donut-svg-wrap"><svg className="donut-svg" viewBox="0 0 160 160" role="img" aria-label="Result distribution donut chart"><circle cx="80" cy="80" r="58" fill="none" stroke="#163440" strokeWidth="18" />{statusData.map((item, index) => { const dash = item.value / 100 * circumference; const element = <circle key={item.name} cx="80" cy="80" r="58" fill="none" stroke={colors[index]} strokeWidth="18" strokeDasharray={`${Math.max(0, dash - 4)} ${circumference - Math.max(0, dash - 4)}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)" />; offset += dash; return element })}</svg><div className="donut-center"><strong>100%</strong><span>sample</span></div></div>
}

function HealthRow({ icon: Icon, label, value, detail, tone }: { icon: React.ElementType; label: string; value: string; detail: string; tone: string }) { return <div className="health-row"><div className={`health-icon ${tone}`}><Icon size={14} /></div><div><strong>{label}</strong><span>{detail}</span></div><b>{value}</b></div> }

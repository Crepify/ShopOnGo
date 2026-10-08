import { Camera, ChevronRight, Cpu, Eye, Filter, RadioTower, ScanLine, Smartphone, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { eventLabel } from '../../fusion/reconciliationEngine'
import { useEventStore, type EventFilter } from '../../stores/eventStore'
import { useSimulationStore } from '../../stores/simulationStore'
import { useSceneStore } from '../../stores/sceneStore'
import { SeverityBadge } from '../common/StatusPill'
import type { SimulationEvent } from '../../types'

const iconFor: Record<SimulationEvent['source'], typeof Camera> = { MOBILE: Smartphone, VISION_SIMULATOR: Eye, SHELF_SIMULATOR: RadioTower, SYSTEM: Cpu, OPERATOR: Zap }
const sourceLabel: Record<SimulationEvent['source'], string> = { MOBILE: 'Mobile', VISION_SIMULATOR: 'Vision', SHELF_SIMULATOR: 'Shelf', SYSTEM: 'System', OPERATOR: 'Operator' }
export function EventTimeline({ compact = false, limit }: { compact?: boolean; limit?: number }) {
  const events = useSimulationStore((state) => state.events)
  const selected = useSimulationStore((state) => state.selectedEventId)
  const selectEvent = useSimulationStore((state) => state.selectEvent)
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  const filter = useEventStore((state) => state.filter)
  const setFilter = useEventStore((state) => state.setFilter)
  const filtered = useMemo(() => { const filteredEvents = events.filter((event) => filter === 'ALL' || (filter === 'WARNINGS' ? event.severity === 'WARNING' : filter === 'ERRORS' ? event.severity === 'ERROR' : event.source === filter)); return (limit === undefined ? filteredEvents : filteredEvents.slice(-limit)).reverse() }, [events, filter, limit])
  const focus = (event: SimulationEvent) => { selectEvent(event.id); setSelectedObject(event.productId ?? event.shelfId ?? event.customerId ?? undefined) }
  return <div className={`timeline-wrap ${compact ? 'compact' : ''}`}>
    {!compact && <div className="timeline-filters"><div className="filter-label"><Filter size={13} /> Filter</div>{(['ALL', 'MOBILE', 'VISION_SIMULATOR', 'SHELF_SIMULATOR', 'SYSTEM', 'OPERATOR', 'WARNINGS', 'ERRORS'] as EventFilter[]).map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'ALL' ? 'All' : item === 'VISION_SIMULATOR' ? 'Vision' : item === 'SHELF_SIMULATOR' ? 'Shelf' : item === 'WARNINGS' ? 'Warnings' : item === 'ERRORS' ? 'Errors' : item.charAt(0) + item.slice(1).toLowerCase()}</button>)}</div>}
    {filtered.length === 0 ? <div className="timeline-empty"><ScanLine size={18} /><span>Event stream awaiting simulation input</span></div> : <div className="timeline-list">{filtered.map((event) => { const Icon = iconFor[event.source]; const isSelected = selected === event.id; return <button key={event.id} className={`timeline-row ${isSelected ? 'selected' : ''}`} onClick={() => focus(event)}><div className={`timeline-source ${event.severity.toLowerCase()}`}><Icon size={14} /></div><div className="timeline-main"><div className="timeline-title"><strong>{eventLabel(event.type)}</strong><span>{sourceLabel[event.source]}</span></div><div className="timeline-description">{String(event.payload.action ?? 'Evidence event')} {event.productId && <em>· {event.productId}</em>}</div><div className="timeline-meta"><span>{formatTime(event.timestamp, useSimulationStore.getState().session.startedAt)}</span>{event.confidence !== undefined && <span>confidence {Math.round(event.confidence * 100)}%</span>}<SeverityBadge severity={event.severity} /></div></div><ChevronRight size={15} className="timeline-arrow" /></button> })}</div>}
  </div>
}
function formatTime(timestamp: number, start: number) { const seconds = Math.max(0, (timestamp - start) / 1000); return `T+${seconds.toFixed(1).padStart(4, '0')}s` }

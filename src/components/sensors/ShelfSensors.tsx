import { Activity, CircleAlert, RadioTower, Thermometer, WifiOff } from 'lucide-react'
import { shelves } from '../../data/shelves'
import { deriveAllShelfStates } from '../../simulation/shelfState'
import { useSimulationStore } from '../../stores/simulationStore'
import type { ShelfState } from '../../types'

export const shelfMovementLabel: Record<ShelfState['movement'], string> = { STABLE: 'STABLE', ITEM_REMOVED: 'ITEM REMOVED', ITEM_RESTORED: 'RESTORED', UNAVAILABLE: 'UNAVAILABLE' }

export function ShelfSensors({ compact = false }: { compact?: boolean }) {
  const events = useSimulationStore((state) => state.events)
  // Physical signals come from the same evidence stream the fusion engine reads.
  const states = deriveAllShelfStates(shelves, events)
  return <div className={`sensor-panel ${compact ? 'compact' : ''}`}><div className="panel-heading"><div><div className="panel-kicker"><RadioTower size={13} /> Smart shelves</div><h3>Physical signal health</h3></div><span className="simulated-label">SIMULATED</span></div><div className="sensor-list">{states.map((state) => { const shelf = shelves.find((item) => item.id === state.shelfId)!; const offline = state.sensorStatus !== 'ONLINE'; const moving = state.movement === 'ITEM_REMOVED' || state.movement === 'ITEM_RESTORED'; return <div className="sensor-row" key={state.shelfId}><div className={`sensor-state ${offline ? 'offline' : moving ? 'moving' : 'online'}`}>{offline ? <WifiOff size={14} /> : moving ? <Activity size={14} /> : <RadioTower size={14} />}</div><div className="sensor-main"><div className="sensor-title"><strong>{shelf.id.replace('-', ' ').toUpperCase()}</strong><span>{offline ? state.sensorStatus : shelfMovementLabel[state.movement]}</span></div><div className="sensor-bar"><i style={{ width: `${Math.max(5, Math.min(100, state.currentWeight / state.baselineWeight * 100))}%` }} /></div><div className="sensor-meta"><span>Base {state.baselineWeight.toFixed(2)} kg</span><span>Now {state.currentWeight.toFixed(2)} kg</span><span className={offline ? 'bad' : 'good'}>{offline ? 'no signal' : `${Math.round(state.confidence * 100)}%`}</span></div></div><button className="sensor-info" title="Sensor detail"><Thermometer size={13} /></button></div> })}</div>{!compact && <div className="sensor-foot"><CircleAlert size={13} /><span>Weight deltas identify movement, not intent or exact attribution.</span></div>}</div>
}

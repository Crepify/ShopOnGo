import { FastForward, Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react'
import { useSimulationStore } from '../../stores/simulationStore'

export function SimulationControls() {
  const { status, speed, start, pause, reset, stop, step, setSpeed, awaitingScanStepId, pendingScan } = useSimulationStore()
  const running = status === 'RUNNING'
  return <div className="sim-controls"><div className="control-main">
    <button className="control-button primary" disabled={Boolean(awaitingScanStepId && !pendingScan)} onClick={() => running ? pause() : start()}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? 'Pause' : awaitingScanStepId && !pendingScan ? 'Scan on phone to continue' : status === 'PAUSED' ? 'Resume' : status === 'COMPLETE' ? 'Replay' : 'Start'}</button>
    <button className="control-button" onClick={step} disabled={running || status === 'COMPLETE' || Boolean(pendingScan || awaitingScanStepId)}><SkipForward size={14} /> Step</button>
    <button className="control-button" onClick={reset}><RotateCcw size={14} /> Restart</button>
    <button className="control-button icon-only" onClick={stop} aria-label="Stop simulation"><Square size={14} /></button>
  </div><div className="speed-control"><FastForward size={13} />{[0.5, 1, 2, 4, 8].map((value) => <button key={value} className={speed === value ? 'active' : ''} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}x</button>)}</div></div>
}

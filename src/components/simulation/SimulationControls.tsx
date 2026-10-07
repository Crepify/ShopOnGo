import { FastForward, Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react'
import { useSimulationStore } from '../../stores/simulationStore'

export function SimulationControls() {
  const { status, speed, start, pause, resume, reset, stop, step, setSpeed } = useSimulationStore()
  const isRunning = status === 'RUNNING'
  return <div className="sim-controls"><div className="control-main"><button className="control-button primary" onClick={() => status === 'PAUSED' ? resume() : start()}>{isRunning ? <Pause size={14} /> : <Play size={14} />}{isRunning ? 'Pause' : status === 'PAUSED' ? 'Resume' : 'Start'}</button><button className="control-button" onClick={step} disabled={isRunning || status === 'COMPLETE'}><SkipForward size={14} /> Step</button><button className="control-button" onClick={reset}><RotateCcw size={14} /> Restart</button><button className="control-button icon-only" onClick={stop} title="Stop"><Square size={14} /></button></div><div className="speed-control"><FastForward size={13} />{[0.5, 1, 2, 4, 8].map((value) => <button key={value} className={speed === value ? 'active' : ''} onClick={() => setSpeed(value)}>{value}x</button>)}</div></div>
}

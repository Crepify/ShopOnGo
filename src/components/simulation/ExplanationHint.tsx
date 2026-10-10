import { ArrowRight, Camera, Check, Eye, Info, RadioTower, ScanLine, ShieldAlert, X } from 'lucide-react'
import type { SimulationHint } from '../../simulation/explanationHints'
import { useSceneStore } from '../../stores/sceneStore'
import { useSimulationStore } from '../../stores/simulationStore'

const iconFor = { STORE: Eye, PHONE: ScanLine, CAMERA: Camera, SHELF: RadioTower, EXIT: ShieldAlert }

export function ExplanationHint({ hint, onDismiss, onNext, paused }: { hint: SimulationHint; onDismiss: () => void; onNext: () => void; paused?: boolean }) {
  const setCameraMode = useSceneStore((state) => state.setCameraMode)
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  const pause = useSimulationStore((state) => state.pause)
  const Icon = iconFor[hint.anchor]
  const focus = () => {
    if (hint.anchor === 'CAMERA') setCameraMode('CAMERA_02')
    if (hint.anchor === 'EXIT') setCameraMode('EXIT_CAMERA')
    if (hint.anchor === 'PHONE') document.querySelector('.shopper-app-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (hint.anchor === 'SHELF') setSelectedObject('shelf-01')
  }
  return <aside className={`explanation-hint ${hint.tone.toLowerCase()}`} role="status"><div className="hint-accent"><Icon size={17} /></div><div className="hint-copy"><div className="hint-kicker"><span>HOW SHOPONGO WORKS</span><em>{hint.anchor}</em></div><strong>{hint.title}</strong><p>{hint.explanation}</p><div className="hint-why"><Check size={12} /><span><b>Why it matters:</b> {hint.whyItMatters}</span></div><div className="hint-actions"><button onClick={focus}><ArrowRight size={13} /> Show signal</button>{paused ? <button onClick={() => useSimulationStore.getState().resume()}><ArrowRight size={13} /> Continue</button> : <button onClick={pause}><Info size={13} /> Pause & explain</button>}<button className="hint-dismiss" onClick={onDismiss} aria-label="Dismiss explanation"><X size={13} /></button></div></div><div className="hint-step"><span>GUIDED</span></div></aside>
}

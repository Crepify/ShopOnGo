import { Activity, ArrowLeft, Camera, CheckCircle2, ChevronRight, Code2, Download, Eye, Focus, Info, RadioTower, RotateCcw, ScanLine, ShieldAlert, SlidersHorizontal, Sparkles, Target, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { StoreScene } from '../scene/StoreScene'
import { deriveCustomerMotion, type CustomerMotionPhase } from '../scene/customerMotion'
import { SimulationControls } from '../components/simulation/SimulationControls'
import { CameraFeed } from '../components/camera/CameraFeed'
import { ShelfSensors } from '../components/sensors/ShelfSensors'
import { VirtualCart } from '../components/cart/VirtualCart'
import { MobilePhone } from '../components/mobile/MobilePhone'
import { EventTimeline } from '../components/timeline/EventTimeline'
import { Modal } from '../components/common/Modal'
import { PageHeader } from '../components/layout/AppShell'
import { StatusPill } from '../components/common/StatusPill'
import { useSimulationStore } from '../stores/simulationStore'
import { useSceneStore, type CameraMode } from '../stores/sceneStore'
import { useSettingsStore } from '../stores/settingsStore'
import { downloadScenarioReport } from '../stores/useAppSnapshot'
import { productById } from '../data/products'
import { shelves } from '../data/shelves'
import { scenarios } from '../data/scenarios'
import { scenarioPasses } from '../simulation/replay'
import { hintForEvent, hintForPhase, type SimulationHint } from '../simulation/explanationHints'
import { ExplanationHint } from '../components/simulation/ExplanationHint'

const cameraModes: Array<{ id: CameraMode; label: string; icon: typeof Camera }> = [{ id: 'OPERATOR', label: 'Operator view', icon: Focus }, { id: 'CUSTOMER_FOLLOW', label: 'Customer follow', icon: UserRound }, { id: 'CAMERA_01', label: 'Camera 01', icon: Camera }, { id: 'CAMERA_02', label: 'Camera 02', icon: Camera }, { id: 'EXIT_CAMERA', label: 'Exit camera', icon: Target }]

const phaseCopy: Record<CustomerMotionPhase, string> = {
  ENTERING: 'Customer is entering the store',
  WALKING_TO_SHELF: 'Customer is walking to the selected shelf',
  LOOKING_AT_PRODUCT: 'Customer is looking at a product',
  REACHING: 'Customer is reaching for an item',
  SCANNING: 'Customer is scanning on the phone',
  PLACING_IN_BAG: 'Item is moving into the bag zone',
  RETURNING_ITEM: 'Customer is returning the item',
  WALKING_TO_EXIT: 'Customer is approaching the exit',
  RECONCILING: 'Phone, camera, and shelf evidence are being compared',
  EXITING: 'Transaction verified — customer is exiting',
  WAITING_FOR_REVIEW: 'Verification required — customer is waiting for review',
}

export function ActiveSimulationPage() {
  const { scenarioId } = useParams()
  const navigate = useNavigate()
  const selectedObject = useSceneStore((state) => state.selectedObject)
  const cameraMode = useSceneStore((state) => state.cameraMode)
  const setCameraMode = useSceneStore((state) => state.setCameraMode)
  const showLabels = useSceneStore((state) => state.showLabels)
  const setShowLabels = useSceneStore((state) => state.setShowLabels)
  const [reportOpen, setReportOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const scenario = useSimulationStore((state) => state.scenario)
  const events = useSimulationStore((state) => state.events)
  const status = useSimulationStore((state) => state.status)
  const result = useSimulationStore((state) => state.result)
  const currentAction = useSimulationStore((state) => state.currentAction)
  const session = useSimulationStore((state) => state.session)
  const elapsedMs = useSimulationStore((state) => state.elapsedMs)
  const debugMode = useSettingsStore((state) => state.debugMode)
  const setSettings = useSettingsStore((state) => state.set)
  const appendOperatorEvent = useSimulationStore((state) => state.appendOperatorEvent)
  const interactionMode = useSimulationStore((state) => state.interactionMode)
  const setInteractionMode = useSimulationStore((state) => state.setInteractionMode)
  const launchScenario = useSimulationStore((state) => state.launchScenario)
  const actualScenario = scenarioId && scenario.id !== scenarioId ? scenarios.find((item) => item.id === scenarioId) : scenario
  useEffect(() => { if (scenarioId && scenario.id !== scenarioId && scenarios.some((item) => item.id === scenarioId)) launchScenario(scenarioId) }, [scenarioId, scenario.id, launchScenario])
  const activeScenario = actualScenario ?? scenario
  const motion = deriveCustomerMotion(activeScenario, elapsedMs, session.exitState)
  const progress = Math.min(100, elapsedMs / (activeScenario.durationSeconds * 1000) * 100)
  const selectedMeta = useMemo(() => {
    if (!selectedObject) return null
    if (productById[selectedObject]) {
      const product = productById[selectedObject]
      return { title: product.name, type: 'Product', id: product.id, details: [`SKU ${product.sku}`, `${product.category} · ₹${product.price}`, `Shelf ${product.shelfId}`], color: product.color }
    }
    const shelf = shelves.find((item) => item.id === selectedObject)
    if (shelf) return { title: shelf.name, type: 'Shelf', id: shelf.id, details: [`Baseline ${shelf.baselineWeight.toFixed(2)} kg`, `${shelf.productIds.length} catalog products`, `Sensor ${shelf.sensorStatus}`], color: '#45dce8' }
    if (selectedObject === 'person_01') return { title: 'Customer track', type: 'Vision track', id: 'person_01', details: ['No facial recognition', 'Association is simulated', `Session ${session.id}`], color: '#5477aa' }
    if (selectedObject === 'exit-01') return { title: 'Exit gate', type: 'Decision boundary', id: 'exit-01', details: [`State ${session.exitState}`, 'No real payment', 'Human-review fallback enabled'], color: '#53e9c3' }
    if (selectedObject === 'bag-zone') return { title: 'Bag zone', type: 'Observability zone', id: 'bag-zone', details: ['Physical visibility can drop', 'Intent is not inferred', 'Click timeline for evidence'], color: '#efb76c' }
    if (selectedObject === 'review-zone') return { title: 'Review zone', type: 'Human review', id: 'review-zone', details: ['Neutral operator fallback', 'No intent is inferred', 'Transaction remains unresolved'], color: '#bd9df0' }
    return null
  }, [selectedObject, session])
  const startFresh = () => { useSimulationStore.getState().launchScenario(activeScenario.id); useSimulationStore.getState().start() }
  const resultStatus = result?.overallStatus ?? 'PENDING'
  const [dismissedHintId, setDismissedHintId] = useState<string>()
  const latestEvent = events.at(-1)
  const eventHint = hintForEvent(latestEvent)
  const phaseHint = hintForPhase(motion.phase)
  const explanationHint: SimulationHint | undefined = eventHint && eventHint.id !== dismissedHintId ? eventHint : phaseHint && phaseHint.id !== dismissedHintId ? phaseHint : undefined
  return <div className="page active-simulation-page">
    <PageHeader eyebrow="Live shopping journey" title={activeScenario.name} description={activeScenario.description} action={<div className="workspace-actions"><button className="outline-button" onClick={() => navigate('/simulator')}><ArrowLeft size={14} /> Scenario library</button><button className="outline-button" onClick={() => setSettings({ debugMode: !debugMode })}><Code2 size={14} /> {debugMode ? 'Hide developer' : 'Developer mode'}</button></div>} />
    <div className="simulation-banner"><div><span className="live-indicator"><i /> {status === 'RUNNING' ? 'LIVE JOURNEY' : status === 'COMPLETE' ? 'JOURNEY COMPLETE' : status}</span><strong>{phaseCopy[motion.phase]}</strong><span className="banner-divider" /><span>Expected <b>{activeScenario.expectedOutcome}</b></span></div><div className="banner-actions"><StatusPill status={resultStatus} small /><button className="text-button" onClick={() => setReportOpen(true)} disabled={!result}>View report <ChevronRight size={13} /></button><button className="icon-button" onClick={() => setInspectorOpen(!inspectorOpen)} title="Toggle companion panels"><SlidersHorizontal size={15} /></button></div></div>
    <JourneyProgress phase={motion.phase} progress={progress} />
    <div className="presentation-mode-bar"><div><span className="panel-kicker"><Sparkles size={13} /> Presentation mode</span><strong>{interactionMode === 'GUIDED' ? 'Guided tour' : 'Interactive scanning'}</strong><small>{interactionMode === 'GUIDED' ? 'The scenario pauses at scan moments so the phone can explain the evidence.' : 'Click a product in the store, open the phone scanner, and control the declaration.'}</small></div><div className="presentation-mode-buttons"><button className={interactionMode === 'GUIDED' ? 'active' : ''} onClick={() => setInteractionMode('GUIDED')}>Guided tour</button><button className={interactionMode === 'INTERACTIVE' ? 'active' : ''} onClick={() => setInteractionMode('INTERACTIVE')}>Interactive scanning</button></div></div>
    {explanationHint && <ExplanationHint hint={explanationHint} paused={status === 'PAUSED'} onDismiss={() => setDismissedHintId(explanationHint.id)} onNext={() => setDismissedHintId(undefined)} />}
    <div className="simulation-layout">
      <div className="scene-column">
        <div className="scene-toolbar"><div className="scene-mode-tabs">{cameraModes.map(({ id, label, icon: Icon }) => <button key={id} className={cameraMode === id ? 'active' : ''} onClick={() => setCameraMode(id)}><Icon size={13} />{label}</button>)}</div><div className="scene-tools"><button className="icon-button" onClick={() => setShowLabels(!showLabels)} title="Toggle scene labels"><Eye size={14} /></button><button className="icon-button" onClick={() => setCameraMode('OPERATOR')} title="Reset operator view"><RotateCcw size={14} /></button><span className="scene-quality"><i className="status-dot green" /> {debugMode ? 'debug' : 'guided'} scene</span></div></div>
        <div className="scene-card"><StoreScene /><div className="scene-legend"><span><i className="legend-dot cyan" /> customer journey</span><span><i className="legend-line" /> camera coverage</span><span><i className="legend-dot amber" /> review boundary</span><span className="scene-hint"><Info size={12} /> click shelves, products, cameras, or the exit</span></div></div>
        <CurrentActionCard motion={motion} result={result} currentAction={currentAction} scenario={activeScenario} />
        <EvidenceBridge scenario={activeScenario} events={events} result={result} />
        <div className="timeline-inline"><div className="timeline-inline-top"><div><span className="panel-kicker"><Activity size={13} /> Journey timeline</span><strong>{events.length} evidence events · {Math.round(elapsedMs / 100) / 10}s elapsed</strong></div><button className="text-button" onClick={() => navigate('/events')}>Open full ledger <ChevronRight size={13} /></button></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><EventTimeline compact limit={5} /></div>
        <SimulationControls />
      </div>
      <aside className={`workspace-rail ${inspectorOpen ? '' : 'rail-collapsed'}`}><div className="rail-header"><div><span className="panel-kicker"><SmartphoneIcon /> Shopper app</span><strong>{selectedMeta ? selectedMeta.type : 'Live companion view'}</strong></div><button className="icon-button" onClick={() => setInspectorOpen(!inspectorOpen)} title="Collapse companion panels"><X size={14} /></button></div><MobilePhone />{selectedMeta ? <SelectionCard selectedMeta={selectedMeta} events={events} /> : <SessionInspector session={session} status={status} scenario={activeScenario.name} result={result?.overallStatus} />}<div className="evidence-panels"><CameraFeed /><ShelfSensors compact /><VirtualCart /></div>{debugMode && <div className="developer-panel"><div className="panel-kicker"><Code2 size={13} /> Developer triggers</div><div className="developer-buttons"><button onClick={() => appendOperatorEvent('CAMERA_UNCERTAIN', { forced: true })}>Force low confidence</button><button onClick={() => appendOperatorEvent('SENSOR_UNAVAILABLE', { forced: true })}>Force sensor failure</button><button onClick={() => appendOperatorEvent('EVENT_BUFFERING', { forced: true })}>Delay event</button><button onClick={() => { const payload = JSON.stringify(events, null, 2); navigator.clipboard?.writeText(payload) }}>Copy event JSON</button></div></div>}</aside>
    </div>
    <div className="workspace-bottom-note"><ShieldAlert size={13} /> All evidence in this workspace is simulated. Review states are neutral and do not make claims about customer intent.</div>
    <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Shopping journey report"><Report scenario={activeScenario} result={result} events={events.length} onExport={downloadScenarioReport} onRestart={() => { setReportOpen(false); startFresh() }} /></Modal>
  </div>
}

function SmartphoneIcon() { return <ScanLine size={13} /> }

function JourneyProgress({ phase, progress }: { phase: CustomerMotionPhase; progress: number }) {
  const steps = [{ key: 'shop', label: 'Browse', active: !['ENTERING'].includes(phase) }, { key: 'pick', label: 'Pick up', active: ['REACHING', 'SCANNING', 'PLACING_IN_BAG', 'RETURNING_ITEM', 'WALKING_TO_EXIT', 'RECONCILING', 'EXITING', 'WAITING_FOR_REVIEW'].includes(phase) }, { key: 'scan', label: 'Scan', active: ['SCANNING', 'PLACING_IN_BAG', 'RETURNING_ITEM', 'WALKING_TO_EXIT', 'RECONCILING', 'EXITING', 'WAITING_FOR_REVIEW'].includes(phase) }, { key: 'verify', label: 'Verify', active: ['RECONCILING', 'EXITING', 'WAITING_FOR_REVIEW'].includes(phase) }, { key: 'exit', label: 'Exit', active: ['EXITING', 'WAITING_FOR_REVIEW'].includes(phase) }]
  return <div className="journey-progress" aria-label="Shopping journey progress"><div className="journey-progress-head"><div><span className="panel-kicker"><Activity size={13} /> Customer journey</span><strong>Phone and store evidence stay in sync</strong></div><span>{Math.round(progress)}%</span></div><div className="journey-steps">{steps.map((step, index) => <div className={`journey-step ${step.active ? 'active' : ''} ${index < steps.length - 1 && steps[index + 1].active ? 'complete' : ''}`} key={step.key}><span className="journey-step-mark">{step.active ? <CheckCircle2 size={13} /> : index + 1}</span><span>{step.label}</span>{index < steps.length - 1 && <i />}</div>)}</div></div>
}

function CurrentActionCard({ motion, result, currentAction, scenario }: { motion: ReturnType<typeof deriveCustomerMotion>; result: ReturnType<typeof useSimulationStore.getState>['result']; currentAction: string; scenario: typeof scenarios[number] }) {
  const physicalProduct = productById[motion.focusProductId]
  const narrative = result?.overallStatus === 'APPROVED' ? 'The declared cart matches the observed shopping journey. The gate is ready to open.' : result ? result.reasons[0] ?? 'The transaction needs a review before the customer can leave.' : motion.phase === 'SCANNING' ? `The customer is declaring ${physicalProduct.name} on the phone.` : `The scene is simulating: ${currentAction}.`
  return <div className="current-action-card"><div className="current-action-icon"><Activity size={18} /></div><div><span className="panel-kicker">WHAT IS HAPPENING NOW</span><strong>{phaseCopy[motion.phase]}</strong><p>{narrative}</p><small>Scenario: {scenario.name}</small></div></div>
}

function EvidenceBridge({ scenario, events, result }: { scenario: typeof scenarios[number]; events: ReturnType<typeof useSimulationStore.getState>['events']; result: ReturnType<typeof useSimulationStore.getState>['result'] }) {
  const physicalProductId = scenario.steps.find((step) => step.eventType === 'CAMERA_PICK_DETECTED')?.productId
  const declaredProductId = scenario.steps.find((step) => step.eventType === 'ITEM_SCANNED')?.productId
  const hasPhone = events.some((event) => event.source === 'MOBILE' && ['ITEM_SCANNED', 'ITEM_SCAN_DUPLICATED'].includes(event.type))
  const hasVision = events.some((event) => event.type === 'CAMERA_PICK_DETECTED' || event.type === 'CAMERA_RETURN_DETECTED' || event.type === 'ITEM_MOVED_TO_BAG')
  const hasShelf = events.some((event) => event.source === 'SHELF_SIMULATOR')
  const status = result?.overallStatus ?? 'PENDING'
  return <div className="evidence-bridge"><div className="evidence-bridge-heading"><div><span className="panel-kicker"><RadioTower size={13} /> Three signals, one decision</span><strong>The shopper app stays separate from physical evidence until reconciliation.</strong></div><StatusPill status={status} small /></div><div className="evidence-bridge-grid"><EvidenceSignal icon={<ScanLine size={15} />} label="Phone" value={declaredProductId ? productById[declaredProductId]?.name ?? declaredProductId : 'No declaration yet'} detail={hasPhone ? 'Mobile scan received' : 'Waiting for a scan'} state={hasPhone ? 'good' : 'waiting'} /><EvidenceSignal icon={<Eye size={15} />} label="Camera" value={physicalProductId ? productById[physicalProductId]?.name ?? physicalProductId : 'Customer track'} detail={hasVision ? 'Physical interaction observed' : 'Waiting for observation'} state={hasVision ? 'good' : 'waiting'} /><EvidenceSignal icon={<RadioTower size={15} />} label="Shelf" value={hasShelf ? 'Weight signal received' : 'Sensor ready'} detail={hasShelf ? 'Supporting physical evidence' : 'Waiting for shelf movement'} state={hasShelf ? 'good' : 'waiting'} /></div></div>
}

function EvidenceSignal({ icon, label, value, detail, state }: { icon: React.ReactNode; label: string; value: string; detail: string; state: 'good' | 'waiting' }) { return <div className={`evidence-signal ${state}`}><div className="evidence-signal-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><i>{state === 'good' ? '✓' : '…'}</i></div> }

function SelectionCard({ selectedMeta, events }: { selectedMeta: { title: string; type: string; id: string; details: string[]; color: string }; events: ReturnType<typeof useSimulationStore.getState>['events'] }) { const related = events.filter((event) => event.relatedObjectIds?.includes(selectedMeta.id) || event.productId === selectedMeta.id || event.shelfId === selectedMeta.id).slice(-4).reverse(); return <div className="selection-card"><div className="selection-swatch" style={{ background: selectedMeta.color }}><Focus size={18} /></div><div className="selection-title"><span>{selectedMeta.type}</span><h3>{selectedMeta.title}</h3><code>{selectedMeta.id}</code></div><div className="selection-details">{selectedMeta.details.map((detail) => <div key={detail}><span /><span>{detail}</span></div>)}</div><div className="selection-related"><strong>Related evidence</strong>{related.map((event) => <div key={event.id} className="selection-related-row"><span>{event.type.replaceAll('_', ' ')}</span><span>{event.confidence !== undefined ? `${Math.round(event.confidence * 100)}%` : '—'}</span></div>)}{related.length === 0 && <em>No related events yet.</em>}</div></div> }

function SessionInspector({ session, status, scenario, result }: { session: ReturnType<typeof useSimulationStore.getState>['session']; status: string; scenario: string; result?: string }) { return <div className="session-inspector"><div className="inspector-hero"><div className="inspector-radar"><div /><div /><div /></div><div><span>SHOPPING SESSION</span><strong>{session.exitState.replaceAll('_', ' ')}</strong><em>{status.toLowerCase()} · local simulation</em></div></div><div className="inspector-list"><div><span>Scenario</span><strong>{scenario}</strong></div><div><span>Customer session</span><strong>{session.id.split('-').pop()?.toUpperCase()}</strong></div><div><span>Reconciliation</span><strong>{result?.replaceAll('_', ' ') ?? 'pending'}</strong></div></div><div className="inspector-note"><Info size={14} /><span>Click a shelf, item, customer, camera, or exit gate to inspect its evidence.</span></div></div> }

function Report({ scenario, result, events, onExport, onRestart }: { scenario: typeof scenarios[number]; result: ReturnType<typeof useSimulationStore.getState>['result']; events: number; onExport: () => void; onRestart: () => void }) {
  const pass = scenarioPasses(scenario, result)
  return <div className="report-body"><div className={`report-result ${pass ? 'pass' : 'review'}`}><div>{pass ? <Sparkles size={22} /> : <ShieldAlert size={22} />}</div><div><span>Actual outcome</span><strong>{result?.overallStatus.replaceAll('_', ' ') ?? 'NOT RUN'}</strong><em>{pass ? 'PASS · expected safety path observed' : 'REVIEW · inspect the evidence path'}</em></div></div><div className="report-grid"><div><span>Expected</span><strong>{scenario.expectedOutcome}</strong></div><div><span>Events</span><strong>{events}</strong></div><div><span>Confidence</span><strong>{result ? `${Math.round(result.confidence * 100)}%` : '—'}</strong></div><div><span>Review reasons</span><strong>{result?.reasons.length ?? 0}</strong></div></div><div className="report-reasons"><span>System notes</span>{(result?.reasons.length ? result.reasons : ['No unresolved reasons recorded.']).map((reason) => <p key={reason}><i />{reason}</p>)}</div><div className="modal-actions"><button className="outline-button" onClick={onExport}><Download size={14} /> Export JSON</button><button className="primary-button" onClick={onRestart}><RotateCcw size={14} /> Replay journey</button></div></div>
}

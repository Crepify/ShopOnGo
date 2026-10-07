import { create } from 'zustand'
import { scenarios, scenarioById } from '../data/scenarios'
import { reconcileEvents } from '../fusion/reconciliationEngine'
import type { ReconciliationResult, Scenario, SessionState, SimulationEvent } from '../types'

export type SimulationStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETE' | 'STOPPED'
export interface SimulationState {
  scenario: Scenario
  status: SimulationStatus
  speed: number
  elapsedMs: number
  nextStep: number
  events: SimulationEvent[]
  session: SessionState
  result?: ReconciliationResult
  selectedEventId?: string
  currentAction: string
  launchScenario: (scenarioId: string) => void
  start: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  reset: () => void
  step: () => void
  tick: (deltaMs: number) => void
  setSpeed: (speed: number) => void
  selectEvent: (eventId?: string) => void
  appendOperatorEvent: (type: SimulationEvent['type'], payload?: Record<string, unknown>) => void
}

const sessionFor = (scenarioId: string): SessionState => ({ id: `session-${scenarioId}-${Date.now().toString(36)}`, customerId: 'person_01', startedAt: Date.now(), exitState: 'READY' })
const initialScenario = scenarios[0]
const severityFor = (event: SimulationEvent['type']): SimulationEvent['severity'] => ['PAYMENT_HELD', 'SKU_MISMATCH', 'QUANTITY_MISMATCH', 'SENSOR_UNAVAILABLE'].includes(event) ? 'ERROR' : ['ITEM_PROVISIONAL', 'ITEM_UNVERIFIED', 'CAMERA_UNCERTAIN', 'EXCEPTION_CREATED', 'TRACK_ASSOCIATION_UNCERTAIN', 'INVENTORY_MISMATCH'].includes(event) ? 'WARNING' : event === 'PAYMENT_APPROVED' || event === 'ITEM_CONFIRMED' ? 'SUCCESS' : 'INFO'

function hydrateEvent(step: Scenario['steps'][number], scenario: Scenario, session: SessionState, index: number): SimulationEvent {
  return {
    id: `${session.id}-${index}-${step.id}`,
    timestamp: session.startedAt + step.delayMs,
    scenarioId: scenario.id,
    sessionId: session.id,
    customerId: step.customerId ?? session.customerId,
    shelfId: step.shelfId,
    productId: step.productId ?? (typeof step.payload?.productId === 'string' ? step.payload.productId : undefined),
    source: step.source,
    type: step.eventType,
    confidence: step.confidence,
    payload: { ...step.payload, action: step.action },
    severity: step.severity ?? severityFor(step.eventType),
    relatedObjectIds: [step.shelfId, step.productId, step.customerId ?? session.customerId].filter(Boolean) as string[],
  }
}

function nextExitState(current: SessionState['exitState'], event: SimulationEvent): SessionState['exitState'] {
  if (event.type === 'EXIT_ATTEMPTED') return 'APPROACHING'
  if (event.type === 'RECONCILIATION_STARTED') return 'RECONCILING'
  if (event.type === 'PAYMENT_APPROVED') return 'APPROVED'
  if (event.type === 'PAYMENT_HELD') return 'PAYMENT_HELD'
  if (event.type === 'EXCEPTION_CREATED') return 'EXCEPTION_REQUIRED'
  if (event.type === 'CAMERA_UNCERTAIN' || event.type === 'TRACK_ASSOCIATION_UNCERTAIN') return 'HUMAN_REVIEW'
  if (event.type === 'SESSION_CLOSED') return 'CLOSED'
  return current
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  scenario: initialScenario,
  status: 'IDLE',
  speed: 1,
  elapsedMs: 0,
  nextStep: 0,
  events: [],
  session: sessionFor(initialScenario.id),
  currentAction: 'Ready to start',
  launchScenario: (scenarioId) => {
    const scenario = scenarioById[scenarioId] ?? initialScenario
    const session = sessionFor(scenario.id)
    set({ scenario, session, status: 'IDLE', elapsedMs: 0, nextStep: 0, events: [], result: undefined, selectedEventId: undefined, currentAction: 'Ready to start' })
  },
  start: () => set({ status: 'RUNNING' }),
  pause: () => set({ status: 'PAUSED' }),
  resume: () => set({ status: 'RUNNING' }),
  stop: () => set({ status: 'STOPPED' }),
  reset: () => {
    const { scenario } = get()
    const session = sessionFor(scenario.id)
    set({ status: 'IDLE', session, elapsedMs: 0, nextStep: 0, events: [], result: undefined, selectedEventId: undefined, currentAction: 'Ready to start' })
  },
  step: () => {
    const { scenario, nextStep } = get()
    const stepData = scenario.steps[nextStep]
    if (!stepData) return set({ status: 'COMPLETE' })
    const target = Math.max(get().elapsedMs, stepData.delayMs)
    set({ status: 'RUNNING' })
    get().tick(target - get().elapsedMs)
    if (get().status !== 'COMPLETE') set({ status: 'PAUSED' })
  },
  tick: (deltaMs) => {
    const state = get()
    if (state.status !== 'RUNNING') return
    const elapsedMs = state.elapsedMs + deltaMs * state.speed
    let nextStep = state.nextStep
    const newlyEmitted: SimulationEvent[] = []
    while (nextStep < state.scenario.steps.length && state.scenario.steps[nextStep].delayMs <= elapsedMs) {
      const step = state.scenario.steps[nextStep]
      newlyEmitted.push(hydrateEvent(step, state.scenario, state.session, nextStep))
      nextStep += 1
    }
    if (!newlyEmitted.length) return set({ elapsedMs })
    const events = [...state.events, ...newlyEmitted]
    const latest = newlyEmitted[newlyEmitted.length - 1]
    const result = reconcileEvents(events, state.session.id)
    const session = { ...state.session, exitState: newlyEmitted.reduce(nextExitState, state.session.exitState), reconciliation: result }
    const complete = nextStep >= state.scenario.steps.length
    set({ elapsedMs, nextStep, events, result, session, currentAction: String(latest.payload.action ?? latest.type), status: complete ? 'COMPLETE' : state.status })
    if (complete) {
      const history = JSON.parse(localStorage.getItem('shopongo-history') ?? localStorage.getItem('sentinelcart-history') ?? '[]') as Array<{ scenarioId: string; outcome: string; at: number }>
      localStorage.setItem('shopongo-history', JSON.stringify([{ scenarioId: state.scenario.id, outcome: result.overallStatus, at: Date.now() }, ...history].slice(0, 20)))
    }
  },
  setSpeed: (speed) => set({ speed }),
  selectEvent: (selectedEventId) => set({ selectedEventId }),
  appendOperatorEvent: (type, payload = {}) => {
    const state = get()
    const event: SimulationEvent = { id: `operator-${Date.now()}`, timestamp: Date.now(), scenarioId: state.scenario.id, sessionId: state.session.id, customerId: state.session.customerId, shelfId: typeof payload.shelfId === 'string' ? payload.shelfId : undefined, productId: typeof payload.productId === 'string' ? payload.productId : undefined, source: type === 'ITEM_SCANNED' || type === 'ITEM_SCAN_DUPLICATED' ? 'MOBILE' : 'OPERATOR', type, payload, severity: severityFor(type), relatedObjectIds: [state.session.customerId, typeof payload.productId === 'string' ? payload.productId : undefined, typeof payload.shelfId === 'string' ? payload.shelfId : undefined].filter(Boolean) as string[] }
    const events = [...state.events, event]
    const result = reconcileEvents(events, state.session.id)
    set({ events, result, session: { ...state.session, reconciliation: result }, currentAction: `Operator event: ${type}` })
  },
}))

export function clearLocalData() {
  localStorage.removeItem('shopongo-history')
  localStorage.removeItem('shopongo-settings')
  // Legacy keys from before the ShopOnGo rename.
  localStorage.removeItem('sentinelcart-history')
  localStorage.removeItem('sentinelcart-settings')
}

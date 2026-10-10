import { create } from 'zustand'
import { scenarios, scenarioById } from '../data/scenarios'
import { reconcileEvents } from '../fusion/reconciliationEngine'
import { productById } from '../data/products'
import { SCAN_DURATION_MS, isScan, type InteractionMode, type PendingScan } from '../simulation/scanner'
import { createSession, hydrateEvent, nextExitState, scenarioDurationMs, severityFor } from '../simulation/replay'
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
  interactionMode: InteractionMode
  pendingScan?: PendingScan
  awaitingScanStepId?: string
  scanError?: string
  runRevision: number
  setInteractionMode: (mode: InteractionMode) => void
  beginScan: (productId: string) => void
  cancelScan: () => void
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

const initialScenario = scenarios[0]

const idleRun = (scenario: Scenario) => ({
  scenario,
  status: 'IDLE' as SimulationStatus,
  elapsedMs: 0,
  nextStep: 0,
  events: [] as SimulationEvent[],
  session: createSession(scenario.id),
  result: undefined as ReconciliationResult | undefined,
  selectedEventId: undefined as string | undefined,
  currentAction: 'Ready to start',
  pendingScan: undefined as PendingScan | undefined,
  awaitingScanStepId: undefined as string | undefined,
  scanError: undefined as string | undefined,
})

/**
 * Advances the run to `targetMs` of scenario time and emits every step that falls
 * inside the window. Speed is applied by the caller (tick) so that a single manual
 * step always advances exactly one event, whatever the playback rate is.
 */
function makeAdvancer(get: () => SimulationState, set: (partial: Partial<SimulationState>) => void) {
  return (targetMs: number) => {
    const state = get()
    const end = scenarioDurationMs(state.scenario)
    let elapsedMs = Math.min(end, Math.max(state.elapsedMs, targetMs))
    // Interactive demos wait before each authored mobile action. Manual scans replace
    // one specific authored step, not every scan of that SKU (duplicates stay explicit).
    const waiting = state.interactionMode === 'INTERACTIVE' ? state.scenario.steps.slice(state.nextStep).find((step) =>
      isScan({ type: step.eventType }) && !state.events.some((event) => event.payload.replacesStepId === step.id)) : undefined
    const checkpoint = waiting ? Math.max(0, waiting.delayMs - SCAN_DURATION_MS) : Infinity
    const mustWait = Boolean(waiting && elapsedMs >= checkpoint)
    if (mustWait) elapsedMs = Math.max(state.elapsedMs, checkpoint)
    let nextStep = state.nextStep
    const emitted: SimulationEvent[] = []
    while (nextStep < state.scenario.steps.length && state.scenario.steps[nextStep].delayMs <= elapsedMs) {
      const step = state.scenario.steps[nextStep]
      if (step.id === waiting?.id && mustWait) break
      if (!state.events.some((event) => event.payload.replacesStepId === step.id)) {
        let event = hydrateEvent(step, state.scenario, state.session, nextStep)
        // Adapt the authored billing narrative to the engine when a person has changed
        // the phone declarations. Visual components never authorize transactions.
        if (state.events.some((e) => e.payload.interaction === 'phone_scanner') &&
          ['ITEM_CONFIRMED', 'PAYMENT_APPROVED', 'PAYMENT_HELD', 'EXCEPTION_CREATED'].includes(event.type)) {
          const outcome = reconcileEvents([...state.events, ...emitted], state.session.id).overallStatus
          if (event.type === 'ITEM_CONFIRMED' && outcome !== 'APPROVED') { nextStep += 1; continue }
          if (['PAYMENT_APPROVED', 'PAYMENT_HELD'].includes(event.type)) {
            const type = outcome === 'APPROVED' ? 'PAYMENT_APPROVED' : 'PAYMENT_HELD'
            event = { ...event, type, severity: severityFor(type), payload: { action: outcome === 'APPROVED' ? 'Simulated checkout approved by reconciliation' : 'Payment held pending verification' } }
          }
          if (event.type === 'EXCEPTION_CREATED' && outcome === 'APPROVED') { nextStep += 1; continue }
        }
        emitted.push(Object.freeze({ ...event, payload: Object.freeze({ ...event.payload }) }))
      }
      nextStep += 1
    }
    const complete = nextStep >= state.scenario.steps.length
    if (!emitted.length) {
      if (elapsedMs === state.elapsedMs && !complete && !mustWait) return
      return set({ elapsedMs, nextStep, awaitingScanStepId: mustWait ? waiting?.id : undefined, status: complete ? 'COMPLETE' : mustWait ? 'PAUSED' : state.status })
    }
    const events = [...state.events, ...emitted]
    const latest = emitted[emitted.length - 1]
    const result = reconcileEvents(events, state.session.id)
    const session = { ...state.session, exitState: emitted.reduce(nextExitState, state.session.exitState), reconciliation: result }
    set({ elapsedMs, nextStep, events, result, session, awaitingScanStepId: mustWait ? waiting?.id : undefined, currentAction: mustWait ? 'Your turn: scan an item on the phone' : String(latest.payload.action ?? latest.type), status: complete ? 'COMPLETE' : mustWait ? 'PAUSED' : state.status })
    if (complete) recordRun(state.scenario.id, result.overallStatus)
  }
}

function recordRun(scenarioId: string, outcome: string) {
  try {
    const history = JSON.parse(localStorage.getItem('shopongo-history') ?? localStorage.getItem('sentinelcart-history') ?? '[]') as Array<{ scenarioId: string; outcome: string; at: number }>
    localStorage.setItem('shopongo-history', JSON.stringify([{ scenarioId, outcome, at: Date.now() }, ...history].slice(0, 20)))
  } catch { /* local storage is optional */ }
}

export const useSimulationStore = create<SimulationState>((set, get) => {
  const advanceTo = makeAdvancer(get, set)
  return {
    ...idleRun(initialScenario),
    speed: 1,
    interactionMode: 'GUIDED',
    runRevision: 0,
    setInteractionMode: (interactionMode) => {
      if (get().pendingScan) return
      set({ interactionMode, awaitingScanStepId: undefined, scanError: undefined })
    },
    beginScan: (productId) => {
      let state = get()
      if (state.pendingScan) return
      if (!productById[productId]) return set({ scanError: 'Select a product from the store or catalog first.' })
      if (['COMPLETE', 'STOPPED'].includes(state.status) || state.events.some((e) => e.type === 'EXIT_ATTEMPTED')) return set({ scanError: 'This shopping trip has reached checkout. Restart to try another scan.' })
      const waiting = state.scenario.steps.find((step) => step.id === state.awaitingScanStepId)
      const replacement = waiting ?? state.scenario.steps.slice(state.nextStep).find((step) => step.eventType === 'ITEM_SCANNED' && step.productId === productId && !state.events.some((e) => e.payload.replacesStepId === step.id))
      if (state.status === 'IDLE') { advanceTo(0); state = get() }
      set({ interactionMode: 'INTERACTIVE', scanError: undefined, status: 'RUNNING', pendingScan: { productId, progressMs: 0, replacesStepId: replacement?.id, duplicate: waiting?.eventType === 'ITEM_SCAN_DUPLICATED' || state.events.some((e) => isScan(e) && e.productId === productId), resumeAfter: state.status === 'RUNNING' || Boolean(waiting) } })
    },
    cancelScan: () => {
      const pending = get().pendingScan
      if (pending) set({ pendingScan: undefined, status: pending.resumeAfter && !get().awaitingScanStepId ? 'RUNNING' : 'PAUSED' })
    },
    launchScenario: (scenarioId) => {
      const scenario = scenarioById[scenarioId] ?? initialScenario
      set({ ...idleRun(scenario), speed: get().speed, runRevision: get().runRevision + 1 })
    },
    // Starting a finished or stopped journey replays it from the beginning instead of
    // leaving the runner spinning past the last event.
    start: () => {
      const { status, scenario } = get()
      if (status === 'COMPLETE' || status === 'STOPPED') set({ ...idleRun(scenario), status: 'RUNNING', speed: get().speed, runRevision: get().runRevision + 1 })
      else set({ status: 'RUNNING' })
    },
    pause: () => set({ status: 'PAUSED' }),
    resume: () => set({ status: 'RUNNING' }),
    // Stop halts playback but keeps the emitted evidence inspectable.
    stop: () => set({ status: 'STOPPED', pendingScan: undefined, awaitingScanStepId: undefined }),
    reset: () => set((state) => ({ ...idleRun(state.scenario), speed: state.speed, runRevision: state.runRevision + 1 })),
    step: () => {
      const state = get()
      if (state.status === 'RUNNING' || state.status === 'COMPLETE' || state.pendingScan || state.awaitingScanStepId) return
      const stepData = state.scenario.steps[state.nextStep]
      if (!stepData) return set({ status: 'COMPLETE' })
      set({ status: 'RUNNING' })
      advanceTo(stepData.delayMs)
      if (get().status !== 'COMPLETE') set({ status: 'PAUSED' })
    },
    tick: (deltaMs) => {
      const state = get()
      if (state.status !== 'RUNNING') return
      if (state.pendingScan) {
        const scan = { ...state.pendingScan, progressMs: Math.min(SCAN_DURATION_MS, state.pendingScan.progressMs + Math.max(0, deltaMs) * state.speed) }
        if (scan.progressMs < SCAN_DURATION_MS) return set({ pendingScan: scan })
        const product = productById[scan.productId]
        const type = scan.duplicate ? 'ITEM_SCAN_DUPLICATED' : 'ITEM_SCANNED'
        const event: SimulationEvent = Object.freeze({ id: `${state.session.id}-phone-${state.events.length}`, timestamp: state.session.startedAt + state.elapsedMs, scenarioId: state.scenario.id, sessionId: state.session.id, customerId: state.session.customerId, productId: product.id, shelfId: product.shelfId, type, source: 'MOBILE', confidence: 0.99, severity: scan.duplicate ? 'WARNING' : 'SUCCESS', payload: Object.freeze({ action: `Phone scanned ${product.name}`, interaction: 'phone_scanner', replacesStepId: scan.replacesStepId }), relatedObjectIds: [product.id, product.shelfId, state.session.customerId] })
        const events = [...state.events, event]
        const result = reconcileEvents(events, state.session.id)
        return set({ pendingScan: undefined, awaitingScanStepId: undefined, events, result, session: { ...state.session, reconciliation: result }, status: scan.resumeAfter ? 'RUNNING' : 'PAUSED', currentAction: `Scan complete: ${product.name}` })
      }
      advanceTo(state.elapsedMs + deltaMs * state.speed)
    },
    setSpeed: (speed) => set({ speed }),
    selectEvent: (selectedEventId) => set({ selectedEventId }),
    appendOperatorEvent: (type, payload = {}) => {
      const state = get()
      const shelfId = typeof payload.shelfId === 'string' ? payload.shelfId : undefined
      const productId = typeof payload.productId === 'string' ? payload.productId : undefined
      const event: SimulationEvent = { id: `operator-${Date.now()}`, timestamp: Date.now(), scenarioId: state.scenario.id, sessionId: state.session.id, customerId: state.session.customerId, shelfId, productId, source: type === 'ITEM_SCANNED' || type === 'ITEM_SCAN_DUPLICATED' ? 'MOBILE' : 'OPERATOR', type, payload, severity: severityFor(type), relatedObjectIds: [shelfId, productId, state.session.customerId].filter(Boolean) as string[] }
      const events = [...state.events, event]
      const result = reconcileEvents(events, state.session.id)
      set({ events, result, session: { ...state.session, exitState: nextExitState(state.session.exitState, event), reconciliation: result }, currentAction: `Operator event: ${type}` })
    },
  }
})

export function clearLocalData() {
  localStorage.removeItem('shopongo-history')
  localStorage.removeItem('shopongo-settings')
  // Legacy keys from before the ShopOnGo rename.
  localStorage.removeItem('sentinelcart-history')
  localStorage.removeItem('sentinelcart-settings')
}

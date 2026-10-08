import { create } from 'zustand'
import { scenarios, scenarioById } from '../data/scenarios'
import { reconcileEvents } from '../fusion/reconciliationEngine'
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
    const elapsedMs = Math.min(end, Math.max(state.elapsedMs, targetMs))
    let nextStep = state.nextStep
    const emitted: SimulationEvent[] = []
    while (nextStep < state.scenario.steps.length && state.scenario.steps[nextStep].delayMs <= elapsedMs) {
      emitted.push(hydrateEvent(state.scenario.steps[nextStep], state.scenario, state.session, nextStep))
      nextStep += 1
    }
    const complete = nextStep >= state.scenario.steps.length
    if (!emitted.length) {
      if (elapsedMs === state.elapsedMs && !complete) return
      return set({ elapsedMs, status: complete ? 'COMPLETE' : state.status })
    }
    const events = [...state.events, ...emitted]
    const latest = emitted[emitted.length - 1]
    const result = reconcileEvents(events, state.session.id)
    const session = { ...state.session, exitState: emitted.reduce(nextExitState, state.session.exitState), reconciliation: result }
    set({ elapsedMs, nextStep, events, result, session, currentAction: String(latest.payload.action ?? latest.type), status: complete ? 'COMPLETE' : state.status })
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
    launchScenario: (scenarioId) => {
      const scenario = scenarioById[scenarioId] ?? initialScenario
      set({ ...idleRun(scenario), speed: get().speed })
    },
    // Starting a finished or stopped journey replays it from the beginning instead of
    // leaving the runner spinning past the last event.
    start: () => {
      const { status, scenario } = get()
      if (status === 'COMPLETE' || status === 'STOPPED') set({ ...idleRun(scenario), status: 'RUNNING', speed: get().speed })
      else set({ status: 'RUNNING' })
    },
    pause: () => set({ status: 'PAUSED' }),
    resume: () => set({ status: 'RUNNING' }),
    // Stop halts playback but keeps the emitted evidence inspectable.
    stop: () => set({ status: 'STOPPED' }),
    reset: () => set((state) => ({ ...idleRun(state.scenario), speed: state.speed })),
    step: () => {
      const state = get()
      if (state.status === 'RUNNING' || state.status === 'COMPLETE') return
      const stepData = state.scenario.steps[state.nextStep]
      if (!stepData) return set({ status: 'COMPLETE' })
      set({ status: 'RUNNING' })
      advanceTo(stepData.delayMs)
      if (get().status !== 'COMPLETE') set({ status: 'PAUSED' })
    },
    tick: (deltaMs) => {
      const state = get()
      if (state.status !== 'RUNNING') return
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

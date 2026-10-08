import { reconcileEvents } from '../fusion/reconciliationEngine'
import type { EventType, ReconciliationResult, Scenario, ScenarioStep, SessionState, Severity, SimulationEvent } from '../types'

/**
 * Scenario playback primitives shared by the runtime store, the report surfaces,
 * and the test suite. Keeping them here means a test replays a journey through
 * exactly the same code path the browser uses.
 */

export function createSession(scenarioId: string, startedAt = Date.now()): SessionState {
  return { id: `session-${scenarioId}-${startedAt.toString(36)}`, customerId: 'person_01', startedAt, exitState: 'READY' }
}

export function severityFor(type: EventType): Severity {
  if (['PAYMENT_HELD', 'SKU_MISMATCH', 'QUANTITY_MISMATCH', 'SENSOR_UNAVAILABLE'].includes(type)) return 'ERROR'
  if (['ITEM_PROVISIONAL', 'ITEM_UNVERIFIED', 'CAMERA_UNCERTAIN', 'EXCEPTION_CREATED', 'TRACK_ASSOCIATION_UNCERTAIN', 'INVENTORY_MISMATCH'].includes(type)) return 'WARNING'
  if (type === 'PAYMENT_APPROVED' || type === 'ITEM_CONFIRMED') return 'SUCCESS'
  return 'INFO'
}

export function eventProductId(step: ScenarioStep): string | undefined {
  return step.productId ?? (typeof step.payload?.productId === 'string' ? step.payload.productId : undefined)
}

export function hydrateEvent(step: ScenarioStep, scenario: Scenario, session: SessionState, index: number): SimulationEvent {
  const productId = eventProductId(step)
  return {
    id: `${session.id}-${index}-${step.id}`,
    timestamp: session.startedAt + step.delayMs,
    scenarioId: scenario.id,
    sessionId: session.id,
    customerId: step.customerId ?? session.customerId,
    shelfId: step.shelfId,
    productId,
    source: step.source,
    type: step.eventType,
    confidence: step.confidence,
    payload: { ...step.payload, action: step.action },
    severity: step.severity ?? severityFor(step.eventType),
    relatedObjectIds: [step.shelfId, productId, step.customerId ?? session.customerId].filter(Boolean) as string[],
  }
}

export function nextExitState(current: SessionState['exitState'], event: SimulationEvent): SessionState['exitState'] {
  if (event.type === 'EXIT_ATTEMPTED') return 'APPROACHING'
  if (event.type === 'RECONCILIATION_STARTED') return 'RECONCILING'
  if (event.type === 'PAYMENT_APPROVED') return 'APPROVED'
  if (event.type === 'PAYMENT_HELD') return 'PAYMENT_HELD'
  if (event.type === 'EXCEPTION_CREATED') return 'EXCEPTION_REQUIRED'
  if (event.type === 'CAMERA_UNCERTAIN' || event.type === 'TRACK_ASSOCIATION_UNCERTAIN') return 'HUMAN_REVIEW'
  if (event.type === 'SESSION_CLOSED') return 'CLOSED'
  return current
}

/** Scenario time (ms) at which the last step of a journey is emitted. */
export function scenarioDurationMs(scenario: Scenario): number {
  return scenario.steps.reduce((longest, step) => Math.max(longest, step.delayMs), 0)
}

export interface ScenarioReplay {
  session: SessionState
  events: SimulationEvent[]
  result: ReconciliationResult
}

/** Replay a full journey deterministically: every step, then one reconciliation. */
export function replayScenario(scenario: Scenario, session = createSession(scenario.id)): ScenarioReplay {
  const events = scenario.steps.map((step, index) => hydrateEvent(step, scenario, session, index))
  return { session: { ...session, exitState: events.reduce(nextExitState, session.exitState) }, events, result: reconcileEvents(events, session.id) }
}

const overallStatuses: ReconciliationResult['overallStatus'][] = ['APPROVED', 'PAYMENT_HELD', 'EXCEPTION_REQUIRED', 'REVIEW_REQUIRED']

/** The overall status a scenario declares, parsed from `"<item status> → <overall status>"`. */
export function expectedOverallStatus(scenario: Scenario): ReconciliationResult['overallStatus'] | undefined {
  const declared = scenario.expectedOutcome.split('→').pop()?.trim()
  return overallStatuses.find((status) => status === declared)
}

/**
 * The overall status the scenario's own narrative events announce (the checkout
 * steps appended by the scenario author). The fusion engine must agree with it,
 * otherwise the timeline and the report contradict each other.
 */
export function narratedOutcome(events: SimulationEvent[]): ReconciliationResult['overallStatus'] | undefined {
  const has = (...types: EventType[]) => events.some((event) => types.includes(event.type))
  if (has('PAYMENT_APPROVED')) return 'APPROVED'
  if (has('EXCEPTION_CREATED')) return 'EXCEPTION_REQUIRED'
  if (has('CAMERA_UNCERTAIN', 'TRACK_ASSOCIATION_UNCERTAIN')) return 'REVIEW_REQUIRED'
  if (has('PAYMENT_HELD')) return 'PAYMENT_HELD'
  return undefined
}

export function scenarioPasses(scenario: Scenario, result?: ReconciliationResult): boolean {
  const expected = expectedOverallStatus(scenario)
  if (!result || !expected) return false
  return result.overallStatus === expected
}

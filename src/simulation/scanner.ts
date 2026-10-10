import { productById } from '../data/products'
import type { Scenario, SimulationEvent } from '../types'

export const SCAN_DURATION_MS = 1200
export type InteractionMode = 'GUIDED' | 'INTERACTIVE'
export interface PendingScan {
  productId: string
  progressMs: number
  replacesStepId?: string
  duplicate: boolean
  resumeAfter: boolean
}

export function isScan(event: { type: string }) {
  return event.type === 'ITEM_SCANNED' || event.type === 'ITEM_SCAN_DUPLICATED'
}

/** Presentation of authored scans. Looking at / picking up an item is not a phone scan. */
export function guidedScanner(scenario: Scenario, elapsedMs: number, events: SimulationEvent[]) {
  const step = scenario.steps.find((candidate) =>
    isScan({ type: candidate.eventType }) && candidate.productId &&
    elapsedMs >= candidate.delayMs - SCAN_DURATION_MS && elapsedMs < candidate.delayMs &&
    !events.some((event) => event.payload.replacesStepId === candidate.id))
  if (!step?.productId || !productById[step.productId]) return undefined
  return { productId: step.productId, progress: Math.max(0, (elapsedMs - step.delayMs + SCAN_DURATION_MS) / SCAN_DURATION_MS) }
}

/** The phone bills declarations, never the maximum of observed and declared quantity. */
export function declaredCart(events: SimulationEvent[]) {
  const quantities = new Map<string, number>()
  const seen = new Set<string>()
  for (const event of events) {
    if (seen.has(event.id) || !event.productId || !productById[event.productId]) continue
    seen.add(event.id)
    if (isScan(event) && event.source === 'MOBILE') quantities.set(event.productId, (quantities.get(event.productId) ?? 0) + 1)
    if (event.type === 'CART_UPDATED' && events.some((e) => e.productId === event.productId && e.type === 'CAMERA_RETURN_DETECTED')) quantities.set(event.productId, 0)
  }
  return [...quantities].filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ product: productById[id], quantity }))
}

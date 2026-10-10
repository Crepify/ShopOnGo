import type { EventType, SimulationEvent } from '../types'
import type { CustomerMotionPhase } from '../scene/customerMotion'

export type HintAnchor = 'STORE' | 'PHONE' | 'CAMERA' | 'SHELF' | 'EXIT'
export interface SimulationHint {
  id: string
  title: string
  explanation: string
  whyItMatters: string
  anchor: HintAnchor
  tone: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  eventId?: string
}

const copy: Partial<Record<EventType, Omit<SimulationHint, 'id' | 'eventId'>>> = {
  SESSION_STARTED: { title: 'Three signals work together', explanation: 'ShopOnGo keeps the phone declaration, camera observation, and shelf signal separate until reconciliation.', whyItMatters: 'No single sensor is treated as perfect evidence.', anchor: 'STORE', tone: 'INFO' },
  CUSTOMER_APPROACHED_SHELF: { title: 'Camera finds the interaction zone', explanation: 'The vision provider tracks where the customer is shopping without using facial recognition.', whyItMatters: 'The system needs a location context before it interprets movement.', anchor: 'CAMERA', tone: 'INFO' },
  CAMERA_PICK_DETECTED: { title: 'Physical interaction detected', explanation: 'The camera observed an item leaving the shelf area. This is physical evidence, not an assumption about intent.', whyItMatters: 'A pickup creates an observed item that can be compared with the phone later.', anchor: 'CAMERA', tone: 'WARNING' },
  SHELF_WEIGHT_DECREASED: { title: 'Shelf intelligence adds support', explanation: 'The shelf registered a weight change that supports the camera observation.', whyItMatters: 'Independent physical evidence can increase confidence in the interaction.', anchor: 'SHELF', tone: 'INFO' },
  ITEM_SCANNED: { title: 'The phone declares the item', explanation: 'The mobile scan represents what the shopper says is in their virtual cart.', whyItMatters: 'A declaration alone does not prove that the physical item was taken.', anchor: 'PHONE', tone: 'SUCCESS' },
  ITEM_MOVED_TO_BAG: { title: 'Visibility has reduced', explanation: 'The physical item became unobservable in the bag zone. The system does not infer intent.', whyItMatters: 'Uncertainty should create review, not an accusation.', anchor: 'CAMERA', tone: 'WARNING' },
  CAMERA_UNCERTAIN: { title: 'The system fails safely', explanation: 'Camera confidence dropped, so ShopOnGo will not force a confirmation.', whyItMatters: 'Ambiguous evidence is escalated to human review.', anchor: 'CAMERA', tone: 'WARNING' },
  SKU_MISMATCH: { title: 'The product declarations disagree', explanation: 'The phone declared one SKU while physical evidence indicates another.', whyItMatters: 'The exit decision uses the mismatch to hold checkout.', anchor: 'EXIT', tone: 'ERROR' },
  SENSOR_UNAVAILABLE: { title: 'A shelf signal is unavailable', explanation: 'The shelf provider stopped reporting for this interaction.', whyItMatters: 'Automatic checkout is disabled rather than silently trusting incomplete evidence.', anchor: 'SHELF', tone: 'ERROR' },
  RECONCILIATION_STARTED: { title: 'Fusion compares the signals', explanation: 'The engine now checks whether the declared product, observed product, quantity, and shelf evidence agree.', whyItMatters: 'The UI presents this result; the reconciliation engine makes it.', anchor: 'EXIT', tone: 'INFO' },
  PAYMENT_APPROVED: { title: 'Exit reconciliation complete', explanation: 'The evidence streams reached the scenario’s approved safety outcome.', whyItMatters: 'This is a simulated authorization only. No payment was processed.', anchor: 'EXIT', tone: 'SUCCESS' },
  PAYMENT_HELD: { title: 'Verification is required', explanation: 'An unresolved discrepancy remains, so payment is held pending review.', whyItMatters: 'The system prefers safe failure to silent approval.', anchor: 'EXIT', tone: 'ERROR' },
}

export function hintForEvent(event?: SimulationEvent): SimulationHint | undefined {
  if (!event) return undefined
  const selected = copy[event.type]
  return selected ? { ...selected, id: `${event.type}-${event.id}`, eventId: event.id } : undefined
}

export function hintForPhase(phase: CustomerMotionPhase): SimulationHint | undefined {
  if (phase === 'WALKING_TO_SHELF') return { id: 'phase-walking', title: 'Watch the approach', explanation: 'The customer track is moving toward a safe interaction point in front of the shelf.', whyItMatters: 'The simulator separates navigation from the actual pickup action.', anchor: 'STORE', tone: 'INFO' }
  if (phase === 'SCANNING') return { id: 'phase-scanning', title: 'A scan creates a declaration', explanation: 'The phone is reading a simulated barcode and preparing a mobile event.', whyItMatters: 'The cart will only count a phone declaration after the scan finishes.', anchor: 'PHONE', tone: 'INFO' }
  if (phase === 'RECONCILING') return { id: 'phase-reconciling', title: 'One decision from three signals', explanation: 'The engine is comparing mobile, camera, and shelf evidence before the gate changes state.', whyItMatters: 'The presentation never lets a visual component approve checkout by itself.', anchor: 'EXIT', tone: 'INFO' }
  return undefined
}

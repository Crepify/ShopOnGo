import type { Scenario } from '../types'
import { productById } from '../data/products'
import { shelfById } from '../data/shelves'

export type Point3 = [number, number, number]

export type CustomerMotionPhase =
  | 'ENTERING'
  | 'WALKING_TO_SHELF'
  | 'LOOKING_AT_PRODUCT'
  | 'REACHING'
  | 'SCANNING'
  | 'PLACING_IN_BAG'
  | 'RETURNING_ITEM'
  | 'WALKING_TO_EXIT'
  | 'RECONCILING'
  | 'EXITING'
  | 'WAITING_FOR_REVIEW'

export interface CustomerMotion {
  position: Point3
  heading: number
  phase: CustomerMotionPhase
  focusProductId: string
  interactionPoint: Point3
  carriedProductId?: string
  itemInBag: boolean
  reachProgress: number
  placementProgress: number
  phoneActive: boolean
}

const FLOOR_Y = 0.18
const ENTRANCE: Point3 = [-7.2, FLOOR_Y, 3.3]
const AISLE_LANE_Z = 1.2
const BAG_ZONE: Point3 = [2.8, FLOOR_Y, 1.45]
const EXIT_GATE: Point3 = [6.8, FLOOR_Y, 1.2]
const OUTSIDE_EXIT: Point3 = [8.45, FLOOR_Y, 1.2]
const REVIEW_ZONE: Point3 = [4.65, FLOOR_Y, 3.25]

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function lerp(a: number, b: number, amount: number) {
  return a + (b - a) * amount
}

function distance(a: Point3, b: Point3) {
  return Math.hypot(b[0] - a[0], b[2] - a[2])
}

function headingBetween(a: Point3, b: Point3) {
  return Math.atan2(-(b[0] - a[0]), -(b[2] - a[2]))
}

function sampleRoute(points: Point3[], progress: number) {
  if (points.length < 2) return { position: points[0] ?? ENTRANCE, heading: 0 }
  const lengths = points.slice(0, -1).map((point, index) => distance(point, points[index + 1]))
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1
  let remaining = clamp(progress) * total
  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index]
    const from = points[index]
    const to = points[index + 1]
    if (remaining <= segmentLength || index === lengths.length - 1) {
      const local = segmentLength ? clamp(remaining / segmentLength) : 1
      return {
        position: [lerp(from[0], to[0], local), FLOOR_Y, lerp(from[2], to[2], local)] as Point3,
        heading: headingBetween(from, to),
      }
    }
    remaining -= segmentLength
  }
  const last = points[points.length - 1]
  return { position: last, heading: headingBetween(points[points.length - 2], last) }
}

function interactionPoint(productId: string): Point3 {
  const product = productById[productId] ?? productById.coffee
  const shelf = shelfById[product.shelfId]
  const normalX = Math.sin(shelf.rotation)
  const normalZ = Math.cos(shelf.rotation)
  return [product.position[0] + normalX * 1.25, FLOOR_Y, product.position[2] + normalZ * 1.25]
}

function routeToShelf(productId: string, point: Point3): Point3[] {
  const product = productById[productId] ?? productById.coffee
  if (product.shelfId === 'shelf-04') {
    // Aisle 04 is rotated. The route goes around its far edge before turning
    // inward, so the customer never walks through the shelf volume.
    return [ENTRANCE, [-7.2, FLOOR_Y, AISLE_LANE_Z], [4, FLOOR_Y, AISLE_LANE_Z], [4, FLOOR_Y, 2.85], [6.65, FLOOR_Y, 2.85], point]
  }
  return [ENTRANCE, [-7.2, FLOOR_Y, AISLE_LANE_Z], [product.position[0], FLOOR_Y, AISLE_LANE_Z], point]
}

function routeFromShelf(productId: string, point: Point3): Point3[] {
  const product = productById[productId] ?? productById.coffee
  if (product.shelfId === 'shelf-04') {
    return [point, [6.65, FLOOR_Y, 2.85], [3.8, FLOOR_Y, 2.85], BAG_ZONE, [3.8, FLOOR_Y, 2.85], [6.8, FLOOR_Y, 2.85], EXIT_GATE]
  }
  return [point, [product.position[0], FLOOR_Y, AISLE_LANE_Z], [3.8, FLOOR_Y, AISLE_LANE_Z], [3.8, FLOOR_Y, 2.85], [6.8, FLOOR_Y, 2.85], EXIT_GATE]
}

function firstStep(scenario: Scenario, eventType: string) {
  return scenario.steps.find((step) => step.eventType === eventType)
}

function firstStepAfter(scenario: Scenario, eventType: string, timestamp: number) {
  return scenario.steps.find((step) => step.eventType === eventType && step.delayMs >= timestamp)
}

export function deriveCustomerMotion(scenario: Scenario, elapsedMs: number, exitState: string): CustomerMotion {
  const pickStep = firstStep(scenario, 'CAMERA_PICK_DETECTED')
  const scanStep = firstStep(scenario, 'ITEM_SCANNED')
  const bagStep = firstStep(scenario, 'ITEM_MOVED_TO_BAG')
  const returnStep = firstStep(scenario, 'CAMERA_RETURN_DETECTED')
  const interactionStep = pickStep ?? scanStep
  const focusProductId = pickStep?.productId ?? scanStep?.productId ?? 'coffee'
  const point = interactionPoint(focusProductId)
  const interactionStart = Math.max(1400, (interactionStep?.delayMs ?? 3200) - 1050)
  const nextPhysicalAction = [scanStep?.delayMs, bagStep?.delayMs, returnStep?.delayMs]
    .filter((value): value is number => value !== undefined && value > (interactionStep?.delayMs ?? 0))
    .sort((a, b) => a - b)[0]
  const interactionEnd = Math.max(interactionStart + 1700, (nextPhysicalAction ?? (interactionStep?.delayMs ?? 3200) + 900) + 450)
  const exitStep = firstStep(scenario, 'EXIT_ATTEMPTED')
  const exitAt = exitStep?.delayMs ?? 8500
  const routeIn = routeToShelf(focusProductId, point)
  const routeOut = routeFromShelf(focusProductId, point)
  const isPicked = Boolean(pickStep && elapsedMs >= pickStep.delayMs + 260 && (!returnStep || elapsedMs < returnStep.delayMs))
  const isInBag = Boolean(isPicked && bagStep && elapsedMs >= bagStep.delayMs)
  const isReturning = Boolean(returnStep && elapsedMs >= returnStep.delayMs - 650 && elapsedMs < returnStep.delayMs + 700)
  const phoneActive = Boolean(scanStep && elapsedMs >= scanStep.delayMs - 420 && elapsedMs < scanStep.delayMs + 900)

  let sampled = sampleRoute(routeIn, clamp((elapsedMs - 300) / Math.max(1, interactionStart - 300)))
  let phase: CustomerMotionPhase = elapsedMs < 900 ? 'ENTERING' : 'WALKING_TO_SHELF'

  if (elapsedMs >= interactionStart && elapsedMs < interactionEnd) {
    sampled = { position: point, heading: headingBetween(point, [productById[focusProductId].position[0], FLOOR_Y, productById[focusProductId].position[2]]) }
    if (isReturning) phase = 'RETURNING_ITEM'
    else if (isInBag && bagStep && elapsedMs < bagStep.delayMs + 850) phase = 'PLACING_IN_BAG'
    else if (phoneActive) phase = 'SCANNING'
    else if (pickStep && elapsedMs >= pickStep.delayMs - 650 && elapsedMs < pickStep.delayMs + 400) phase = 'REACHING'
    else phase = 'LOOKING_AT_PRODUCT'
  } else if (elapsedMs >= interactionEnd && elapsedMs < exitAt) {
    sampled = sampleRoute(routeOut, clamp((elapsedMs - interactionEnd) / Math.max(1, exitAt - interactionEnd)))
    phase = 'WALKING_TO_EXIT'
  } else if (elapsedMs >= exitAt && ['APPROVED', 'CLOSED'].includes(exitState)) {
    const approvedAt = firstStep(scenario, 'PAYMENT_APPROVED')?.delayMs ?? exitAt + 1200
    sampled = sampleRoute([EXIT_GATE, OUTSIDE_EXIT], clamp((elapsedMs - approvedAt) / 1200))
    phase = 'EXITING'
  } else if (elapsedMs >= exitAt && ['PAYMENT_HELD', 'EXCEPTION_REQUIRED', 'HUMAN_REVIEW'].includes(exitState)) {
    const reviewAt = firstStepAfter(scenario, 'PAYMENT_HELD', exitAt)?.delayMs ?? firstStepAfter(scenario, 'EXCEPTION_CREATED', exitAt)?.delayMs ?? exitAt + 1200
    sampled = sampleRoute([EXIT_GATE, [7.55, FLOOR_Y, 2.85], REVIEW_ZONE], clamp((elapsedMs - reviewAt) / 1100))
    phase = 'WAITING_FOR_REVIEW'
  } else if (elapsedMs >= exitAt) {
    sampled = { position: EXIT_GATE, heading: headingBetween(EXIT_GATE, [7.5, FLOOR_Y, 1.2]) }
    phase = exitState === 'RECONCILING' ? 'RECONCILING' : 'WALKING_TO_EXIT'
  }

  const reachProgress = pickStep ? clamp((elapsedMs - (pickStep.delayMs - 650)) / 900) : 0
  const placementProgress = bagStep ? clamp((elapsedMs - bagStep.delayMs) / 850) : 0
  return {
    position: sampled.position,
    heading: sampled.heading,
    phase,
    focusProductId,
    interactionPoint: point,
    carriedProductId: isPicked ? focusProductId : undefined,
    itemInBag: isInBag,
    reachProgress,
    placementProgress,
    phoneActive,
  }
}

import { productById } from '../data/products'
import type { Shelf, ShelfState, SimulationEvent } from '../types'

const unitsFor = (event: SimulationEvent) => Math.max(1, Number(event.payload.quantity ?? 1) || 1)

/** Weight of the observed movement, taken from the product catalog rather than a magic number. */
export function movementKilograms(event: SimulationEvent): number {
  const product = event.productId ? productById[event.productId] : undefined
  return ((product?.weightGrams ?? 0) / 1000) * unitsFor(event)
}

/**
 * Derives the physical shelf state from the evidence stream. This is the same
 * boundary a hardware adapter would publish, so the panel never invents a weight.
 */
export function deriveShelfState(shelf: Shelf, events: SimulationEvent[]): ShelfState {
  let delta = 0
  let movement: ShelfState['movement'] = 'STABLE'
  let sensorStatus: ShelfState['sensorStatus'] = shelf.sensorStatus
  let confidence = 0.95
  let lastUpdated = 0

  for (const event of events) {
    if (event.shelfId !== shelf.id) continue
    switch (event.type) {
      case 'SHELF_WEIGHT_DECREASED':
        delta -= movementKilograms(event)
        movement = 'ITEM_REMOVED'
        break
      case 'SHELF_WEIGHT_RESTORED':
        delta = 0
        movement = 'ITEM_RESTORED'
        break
      case 'SENSOR_UNAVAILABLE':
        sensorStatus = 'OFFLINE'
        movement = 'UNAVAILABLE'
        break
      case 'AUTOMATIC_CHECKOUT_DISABLED':
        // Once a sensor is offline it stays offline; disabling checkout cannot improve it.
        if (sensorStatus !== 'OFFLINE') sensorStatus = 'DEGRADED'
        movement = 'UNAVAILABLE'
        break
      default:
        continue
    }
    confidence = sensorStatus === 'OFFLINE' || sensorStatus === 'DEGRADED' ? 0 : event.confidence ?? confidence
    lastUpdated = event.timestamp
  }

  return {
    shelfId: shelf.id,
    baselineWeight: shelf.baselineWeight,
    currentWeight: Math.max(0, Math.round((shelf.baselineWeight + delta) * 1000) / 1000),
    delta: Math.round(delta * 1000) / 1000,
    sensorStatus,
    confidence,
    movement,
    lastUpdated,
  }
}

export function deriveAllShelfStates(shelves: Shelf[], events: SimulationEvent[]): ShelfState[] {
  return shelves.map((shelf) => deriveShelfState(shelf, events))
}

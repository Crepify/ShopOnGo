import { productById } from '../data/products'
import type { CartItemState, EventType, ItemReconciliationResult, ItemStatus, ReconciliationResult, SimulationEvent } from '../types'

/**
 * Evidence fusion. Pure and UI-independent: it turns an ordered event stream into
 * an explicit ReconciliationResult. The UI never derives a checkout decision itself.
 */

interface ItemEvidence {
  /** Lowest confidence seen per event type, so repeated doubt lowers the score. */
  signals: Map<EventType, number>
}

const clampConfidence = (value: number) => Math.round(Math.max(0, Math.min(0.99, value)) * 100) / 100

export function reconcileEvents(events: SimulationEvent[], sessionId: string): ReconciliationResult {
  const byProduct = new Map<string, CartItemState>()
  const evidence = new Map<string, ItemEvidence>()
  const reasons: string[] = []

  const ensure = (productId: string, timestamp: number, shelfId?: string) => {
    if (!byProduct.has(productId)) {
      byProduct.set(productId, { productId, quantity: 0, scannedQuantity: 0, observedQuantity: 0, scanned: false, observed: false, status: 'UNVERIFIED', confidence: 0.5, firstSeen: timestamp, shelfId: shelfId ?? productById[productId]?.shelfId ?? 'unknown' })
      evidence.set(productId, { signals: new Map() })
    }
    return byProduct.get(productId)!
  }

  const record = (productId: string, event: SimulationEvent) => {
    const confidence = event.confidence
    if (confidence === undefined) return
    const entry = evidence.get(productId)!
    const previous = entry.signals.get(event.type)
    entry.signals.set(event.type, previous === undefined ? confidence : Math.min(previous, confidence))
  }

  /**
   * Which cart lines an event speaks about. Events usually name a product; shelf
   * scoped events (a sensor dropping out, checkout being disabled for an aisle)
   * apply to every line already tracked on that shelf.
   */
  const linesFor = (event: SimulationEvent): string[] => {
    const productId = event.productId ?? (typeof event.payload.productId === 'string' ? event.payload.productId : undefined)
    if (productId && productById[productId]) return [productId]
    if (!event.shelfId) return []
    const shelfId = event.shelfId
    return [...byProduct.keys()].filter((tracked) => byProduct.get(tracked)!.shelfId === shelfId)
  }

  for (const event of events) {
    for (const productId of linesFor(event)) {
      const state = ensure(productId, event.timestamp, event.shelfId)
      record(productId, event)
      if (event.type === 'ITEM_SCANNED' || event.type === 'ITEM_SCAN_DUPLICATED') {
        state.scanned = true
        state.scannedQuantity += 1
        state.quantity = Math.max(state.quantity, state.scannedQuantity)
      }
      if (event.type === 'CAMERA_PICK_DETECTED') {
        state.observed = true
        state.observedQuantity += Number(event.payload.quantity ?? 1) || 1
        state.quantity = Math.max(state.quantity, state.observedQuantity)
      }
      if (event.type === 'ITEM_MOVED_TO_BAG') {
        state.observed = true
        state.observedQuantity = Math.max(state.observedQuantity, 1)
      }
      if (event.type === 'CAMERA_RETURN_DETECTED' || event.type === 'SHELF_WEIGHT_RESTORED') {
        state.observed = false
        state.observedQuantity = 0
      }
    }
  }

  const hasSensorFailure = events.some((event) => event.type === 'SENSOR_UNAVAILABLE' || event.type === 'AUTOMATIC_CHECKOUT_DISABLED')
  const hasCameraUncertainty = events.some((event) => event.type === 'CAMERA_UNCERTAIN' || event.type === 'TRACK_ASSOCIATION_UNCERTAIN')
  const hasSkuMismatch = events.some((event) => event.type === 'SKU_MISMATCH')
  const hasQuantityMismatch = events.some((event) => event.type === 'QUANTITY_MISMATCH' || event.type === 'ITEM_SCAN_DUPLICATED') || [...byProduct.values()].some((item) => item.scanned && item.observed && item.scannedQuantity !== item.observedQuantity)
  const hasWrongShelf = events.some((event) => event.type === 'INVENTORY_MISMATCH')
  const hasException = events.some((event) => event.type === 'EXCEPTION_CREATED')
  const hasReturn = events.some((event) => event.type === 'CAMERA_RETURN_DETECTED')

  const itemResults: ItemReconciliationResult[] = []
  for (const state of byProduct.values()) {
    const signals = evidence.get(state.productId)!.signals
    /** Lowest confidence recorded for any of `types`, or `fallback` when none arrived. */
    const lowest = (fallback: number, ...types: EventType[]) => { const values = types.map((type) => signals.get(type)).filter((value): value is number => value !== undefined); return values.length ? Math.min(...values) : fallback }
    const swapEvidence = events.some((event) => event.type === 'SKU_MISMATCH' && event.productId === state.productId)
    const duplicated = events.some((event) => event.type === 'ITEM_SCAN_DUPLICATED' && event.productId === state.productId)

    let status: ItemStatus = state.status
    let reason = ''
    if (hasSkuMismatch && swapEvidence) { status = 'SKU_MISMATCH'; reason = 'Mobile-declared SKU differs from physically observed SKU.' }
    else if (hasQuantityMismatch && (duplicated || state.scannedQuantity !== state.observedQuantity)) { status = 'QUANTITY_MISMATCH'; reason = 'Declared and observed quantities do not match.' }
    else if (hasSensorFailure && state.observed) { status = 'SENSOR_UNAVAILABLE'; reason = 'Shelf evidence is unavailable for this interaction.' }
    else if (hasCameraUncertainty && state.observed) { status = 'CAMERA_UNCERTAIN'; reason = 'Visual evidence is below the confirmation threshold.' }
    else if (hasWrongShelf) { status = 'EXCEPTION_REQUIRED'; reason = 'Observed return zone differs from the mapped shelf zone.' }
    else if (!state.observed && state.scanned) { status = hasReturn ? 'RETURNED' : 'UNVERIFIED'; reason = hasReturn ? 'Item was observed returning to shelf.' : 'Mobile scan has no matching physical evidence.' }
    else if (state.observed && !state.scanned) { status = 'PROVISIONAL'; reason = 'Physical item has no matching mobile scan.' }
    else if (state.observed && state.scanned) { status = 'CONFIRMED'; reason = 'Mobile scan, vision, and shelf evidence agree.' }

    state.status = status
    // Confidence describes how well the evidence supports the status above, so it is
    // read from the signal that produced that status instead of a flat default.
    const confidenceFor: Record<ItemStatus, number> = {
      CONFIRMED: lowest(0.94, 'ITEM_CONFIRMED'),
      RETURNED: lowest(0.96, 'CART_UPDATED'),
      SKU_MISMATCH: lowest(0.8, 'SKU_MISMATCH'),
      QUANTITY_MISMATCH: lowest(0.8, 'QUANTITY_MISMATCH', 'ITEM_SCAN_DUPLICATED'),
      CAMERA_UNCERTAIN: lowest(0.5, 'CAMERA_UNCERTAIN', 'TRACK_ASSOCIATION_UNCERTAIN'),
      SENSOR_UNAVAILABLE: 0,
      EXCEPTION_REQUIRED: lowest(0.6, 'INVENTORY_MISMATCH', 'EXCEPTION_CREATED'),
      PROVISIONAL: lowest(0.6, 'ITEM_PROVISIONAL'),
      UNVERIFIED: lowest(0.55, 'ITEM_UNVERIFIED'),
    }
    state.confidence = clampConfidence(confidenceFor[status])
    if (reason) reasons.push(reason)
    itemResults.push({ ...state, productName: productById[state.productId].name, price: productById[state.productId].price, reason })
  }

  const hasUnverifiedDeclaration = itemResults.some((item) => item.status === 'UNVERIFIED')
  if (hasSensorFailure) reasons.push('Automatic checkout disabled while a shelf sensor is unavailable.')
  if (hasUnverifiedDeclaration) reasons.push('Declared items have no matching physical evidence, so checkout is held.')
  if (hasCameraUncertainty) reasons.push('Human review required because customer-to-item evidence is uncertain.')
  if (hasException) reasons.push('Exception workflow created for operator review.')
  if (events.some((event) => event.type === 'EVENT_BUFFERING')) reasons.push('Events were buffered to allow delayed evidence to arrive.')

  const overallStatus: ReconciliationResult['overallStatus'] =
    hasSensorFailure || hasSkuMismatch || hasQuantityMismatch || hasUnverifiedDeclaration ? 'PAYMENT_HELD' :
    hasCameraUncertainty ? 'REVIEW_REQUIRED' :
    itemResults.some((item) => ['PROVISIONAL', 'EXCEPTION_REQUIRED', 'UNVERIFIED', 'CAMERA_UNCERTAIN', 'SENSOR_UNAVAILABLE'].includes(item.status)) || hasWrongShelf || hasException ? 'EXCEPTION_REQUIRED' : 'APPROVED'
  const confidence = itemResults.length ? clampConfidence(itemResults.reduce((sum, item) => sum + item.confidence, 0) / itemResults.length) : 0.5
  return { sessionId, itemResults, overallStatus, confidence, reasons: [...new Set(reasons)] }
}

export function eventLabel(type: SimulationEvent['type']): string {
  return type.replaceAll('_', ' ').toLowerCase().replace(/(^| )\S/g, (letter) => letter.toUpperCase())
}

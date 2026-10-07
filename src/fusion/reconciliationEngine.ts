import { productById } from '../data/products'
import type { CartItemState, ItemReconciliationResult, ReconciliationResult, SimulationEvent } from '../types'

export function reconcileEvents(events: SimulationEvent[], sessionId: string): ReconciliationResult {
  const byProduct = new Map<string, CartItemState>()
  const reasons: string[] = []
  const ensure = (productId: string, timestamp: number, shelfId = productById[productId]?.shelfId ?? 'unknown') => {
    if (!byProduct.has(productId)) byProduct.set(productId, { productId, quantity: 0, scannedQuantity: 0, observedQuantity: 0, scanned: false, observed: false, status: 'UNVERIFIED', confidence: 0.5, firstSeen: timestamp, shelfId })
    return byProduct.get(productId)!
  }

  for (const event of events) {
    const productId = event.productId ?? (typeof event.payload.productId === 'string' ? event.payload.productId : undefined)
    if (productId && productById[productId]) {
      const state = ensure(productId, event.timestamp, event.shelfId)
      if (event.type === 'ITEM_SCANNED') {
        state.scanned = true
        state.scannedQuantity += 1
        state.quantity = Math.max(state.quantity, state.scannedQuantity)
      }
      if (event.type === 'ITEM_SCAN_DUPLICATED') {
        state.scanned = true
        state.scannedQuantity += 1
        state.quantity = Math.max(state.quantity, state.scannedQuantity)
      }
      if (event.type === 'CAMERA_PICK_DETECTED') {
        state.observed = true
        state.observedQuantity += Number(event.payload.quantity ?? 1)
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
      if (event.type === 'CAMERA_UNCERTAIN' || event.type === 'ITEM_PROVISIONAL') state.confidence = Math.min(state.confidence, event.confidence ?? 0.6)
      if (event.type === 'SENSOR_UNAVAILABLE') state.confidence = 0
      if (event.type === 'SKU_MISMATCH') state.confidence = Math.min(state.confidence, event.confidence ?? 0.8)
      if (event.type === 'INVENTORY_MISMATCH') state.confidence = Math.min(state.confidence, event.confidence ?? 0.7)
    }
  }

  const hasSensorFailure = events.some((event) => event.type === 'SENSOR_UNAVAILABLE' || event.type === 'AUTOMATIC_CHECKOUT_DISABLED')
  const hasCameraUncertainty = events.some((event) => event.type === 'CAMERA_UNCERTAIN' || event.type === 'TRACK_ASSOCIATION_UNCERTAIN')
  const hasSkuMismatch = events.some((event) => event.type === 'SKU_MISMATCH')
  const hasQuantityMismatch = events.some((event) => event.type === 'QUANTITY_MISMATCH' || event.type === 'ITEM_SCAN_DUPLICATED')
  const hasWrongShelf = events.some((event) => event.type === 'INVENTORY_MISMATCH')
  const hasException = events.some((event) => event.type === 'EXCEPTION_CREATED')

  const itemResults: ItemReconciliationResult[] = []
  for (const state of byProduct.values()) {
    const scannedId = events.find((event) => event.type === 'ITEM_SCANNED' && event.productId)?.productId
    const swapEvidence = events.find((event) => event.type === 'SKU_MISMATCH' && event.productId === state.productId)
    let status = state.status
    let reason = ''
    if (hasSkuMismatch && swapEvidence) { status = 'SKU_MISMATCH'; reason = 'Mobile-declared SKU differs from physically observed SKU.' }
    else if (hasQuantityMismatch && (state.scannedQuantity !== state.observedQuantity || events.some((event) => event.type === 'ITEM_SCAN_DUPLICATED' && event.productId === state.productId))) { status = 'QUANTITY_MISMATCH'; reason = 'Declared and observed quantities do not match.' }
    else if (hasSensorFailure && state.observed) { status = 'SENSOR_UNAVAILABLE'; reason = 'Shelf evidence is unavailable for this interaction.' }
    else if (hasCameraUncertainty && state.observed) { status = 'CAMERA_UNCERTAIN'; reason = 'Visual evidence is below the confirmation threshold.' }
    else if (hasWrongShelf) { status = 'EXCEPTION_REQUIRED'; reason = 'Observed return zone differs from the mapped shelf zone.' }
    else if (!state.observed && state.scanned) { status = events.some((event) => event.type === 'CAMERA_RETURN_DETECTED') ? 'RETURNED' : 'UNVERIFIED'; reason = events.some((event) => event.type === 'CAMERA_RETURN_DETECTED') ? 'Item was observed returning to shelf.' : 'Mobile scan has no matching physical evidence.' }
    else if (state.observed && !state.scanned) { status = 'PROVISIONAL'; reason = 'Physical item has no matching mobile scan.' }
    else if (state.observed && state.scanned) { status = 'CONFIRMED'; reason = 'Mobile scan, vision, and shelf evidence agree.' }
    state.status = status
    state.confidence = Math.round(Math.max(0, Math.min(0.99, status === 'CONFIRMED' ? 0.94 : status === 'RETURNED' ? 0.96 : state.confidence)) * 100) / 100
    if (reason) reasons.push(reason)
    itemResults.push({ ...state, productName: productById[state.productId].name, price: productById[state.productId].price, reason })
  }

  if (hasSensorFailure) reasons.push('Automatic checkout disabled while a shelf sensor is unavailable.')
  if (hasCameraUncertainty) reasons.push('Human review required because customer-to-item evidence is uncertain.')
  if (hasException) reasons.push('Exception workflow created for operator review.')
  if (events.some((event) => event.type === 'EVENT_BUFFERING')) reasons.push('Events were buffered to allow delayed evidence to arrive.')

  const overallStatus: ReconciliationResult['overallStatus'] =
    hasSensorFailure || hasSkuMismatch || hasQuantityMismatch ? 'PAYMENT_HELD' :
    hasCameraUncertainty ? 'REVIEW_REQUIRED' :
    itemResults.some((item) => ['PROVISIONAL', 'EXCEPTION_REQUIRED', 'UNVERIFIED', 'CAMERA_UNCERTAIN', 'SENSOR_UNAVAILABLE'].includes(item.status)) || hasWrongShelf || hasException ? 'EXCEPTION_REQUIRED' : 'APPROVED'
  const confidence = itemResults.length ? Math.round(itemResults.reduce((sum, item) => sum + item.confidence, 0) / itemResults.length * 100) / 100 : 0.5
  return { sessionId, itemResults, overallStatus, confidence, reasons: [...new Set(reasons)] }
}

export function eventLabel(type: SimulationEvent['type']): string {
  return type.replaceAll('_', ' ').toLowerCase().replace(/(^| )\S/g, (letter) => letter.toUpperCase())
}

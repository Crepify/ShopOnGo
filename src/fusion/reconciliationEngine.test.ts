import { describe, expect, it } from 'vitest'
import { reconcileEvents } from './reconciliationEngine'
import type { SimulationEvent } from '../types'

const event = (type: SimulationEvent['type'], productId = 'coffee', extra: Partial<SimulationEvent> = {}): SimulationEvent => ({ id: `${type}-${Math.random()}`, timestamp: Date.now(), scenarioId: 'test', sessionId: 'test-session', source: type.includes('SCAN') ? 'MOBILE' : type.includes('SHELF') || type.includes('SENSOR') ? 'SHELF_SIMULATOR' : type.includes('ITEM_') || type.includes('CAMERA') ? 'VISION_SIMULATOR' : 'SYSTEM', type, productId, payload: {}, severity: 'INFO', confidence: .92, ...extra })

describe('reconciliation engine', () => {
  it('confirms a matching pick and scan', () => expect(reconcileEvents([event('CAMERA_PICK_DETECTED'), event('ITEM_SCANNED')], 'test-session').itemResults[0].status).toBe('CONFIRMED'))
  it('marks a physical pick without scan provisional', () => expect(reconcileEvents([event('CAMERA_PICK_DETECTED', 'milk')], 'test-session').itemResults[0].status).toBe('PROVISIONAL'))
  it('marks a scan without pick unverified', () => expect(reconcileEvents([event('ITEM_SCANNED', 'chips')], 'test-session').itemResults[0].status).toBe('UNVERIFIED'))
  it('holds on SKU mismatch', () => { const result = reconcileEvents([event('ITEM_SCANNED', 'coffee'), event('CAMERA_PICK_DETECTED', 'milk'), event('SKU_MISMATCH', 'milk')], 'test-session'); expect(result.overallStatus).toBe('PAYMENT_HELD'); expect(result.itemResults.find((item) => item.productId === 'milk')?.status).toBe('SKU_MISMATCH') })
  it('holds on quantity mismatch and duplicate scans', () => { const result = reconcileEvents([event('CAMERA_PICK_DETECTED', 'chips'), event('ITEM_SCANNED', 'chips'), event('ITEM_SCAN_DUPLICATED', 'chips')], 'test-session'); expect(result.itemResults[0].status).toBe('QUANTITY_MISMATCH') })
  it('handles returns as a cart update', () => { const result = reconcileEvents([event('ITEM_SCANNED', 'juice'), event('CAMERA_PICK_DETECTED', 'juice'), event('CAMERA_RETURN_DETECTED', 'juice'), event('SHELF_WEIGHT_RESTORED', 'juice')], 'test-session'); expect(result.itemResults[0].status).toBe('RETURNED'); expect(result.overallStatus).toBe('APPROVED') })
  it('routes camera uncertainty to review', () => { const result = reconcileEvents([event('CAMERA_PICK_DETECTED'), event('CAMERA_UNCERTAIN', 'coffee', { confidence: .39 })], 'test-session'); expect(result.overallStatus).toBe('REVIEW_REQUIRED') })
  it('holds when shelf evidence is unavailable', () => { const result = reconcileEvents([event('CAMERA_PICK_DETECTED', 'milk'), event('SENSOR_UNAVAILABLE', 'milk')], 'test-session'); expect(result.overallStatus).toBe('PAYMENT_HELD') })
})

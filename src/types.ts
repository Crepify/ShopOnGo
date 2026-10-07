export type EventSource = 'MOBILE' | 'VISION_SIMULATOR' | 'SHELF_SIMULATOR' | 'SYSTEM' | 'OPERATOR'
export type Severity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
export type EventType =
  | 'SESSION_STARTED'
  | 'CUSTOMER_ENTERED_ZONE'
  | 'CUSTOMER_APPROACHED_SHELF'
  | 'CAMERA_PICK_DETECTED'
  | 'CAMERA_RETURN_DETECTED'
  | 'ITEM_MOVED_TO_BAG'
  | 'ITEM_HANDED_OFF'
  | 'SHELF_WEIGHT_DECREASED'
  | 'SHELF_WEIGHT_RESTORED'
  | 'ITEM_SCANNED'
  | 'ITEM_SCAN_DUPLICATED'
  | 'EXIT_ATTEMPTED'
  | 'RECONCILIATION_STARTED'
  | 'ITEM_CONFIRMED'
  | 'ITEM_PROVISIONAL'
  | 'ITEM_UNVERIFIED'
  | 'SKU_MISMATCH'
  | 'QUANTITY_MISMATCH'
  | 'CAMERA_UNCERTAIN'
  | 'SENSOR_UNAVAILABLE'
  | 'EXCEPTION_CREATED'
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_HELD'
  | 'SESSION_CLOSED'
  | 'TRACK_ASSOCIATION_UNCERTAIN'
  | 'EVENT_BUFFERING'
  | 'INVENTORY_MISMATCH'
  | 'CART_UPDATED'
  | 'AUTOMATIC_CHECKOUT_DISABLED'

export interface SimulationEvent {
  id: string
  timestamp: number
  scenarioId: string
  sessionId: string
  customerId?: string
  shelfId?: string
  productId?: string
  source: EventSource
  type: EventType
  confidence?: number
  payload: Record<string, unknown>
  severity: Severity
  relatedObjectIds?: string[]
}

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  price: number
  weightGrams: number
  color: string
  shelfId: string
  position: [number, number, number]
  dimensions: [number, number, number]
  image?: string
}

export type SensorStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE'
export interface Shelf {
  id: string
  name: string
  position: [number, number, number]
  rotation: number
  productIds: string[]
  baselineWeight: number
  currentWeight: number
  sensorStatus: SensorStatus
}

export interface SimulatedCamera {
  id: string
  name: string
  position: [number, number, number]
  target: [number, number, number]
  coverageZoneIds: string[]
  status: SensorStatus
}

export type ScenarioCategory = 'NORMAL' | 'DISCREPANCY' | 'FAILURE' | 'EDGE_CASE'
export interface ScenarioStep {
  id: string
  delayMs: number
  action: string
  eventType: EventType
  source: EventSource
  customerId?: string
  shelfId?: string
  productId?: string
  payload?: Record<string, unknown>
  confidence?: number
  severity?: Severity
}
export interface Scenario {
  id: string
  name: string
  description: string
  category: ScenarioCategory
  risk: 'LOW' | 'MEDIUM' | 'HIGH'
  durationSeconds: number
  expectedOutcome: string
  eventsCount: number
  steps: ScenarioStep[]
  limitations?: string[]
}

export type ItemStatus = 'CONFIRMED' | 'PROVISIONAL' | 'UNVERIFIED' | 'SKU_MISMATCH' | 'QUANTITY_MISMATCH' | 'RETURNED' | 'CAMERA_UNCERTAIN' | 'SENSOR_UNAVAILABLE' | 'EXCEPTION_REQUIRED'
export interface CartItemState {
  productId: string
  quantity: number
  scannedQuantity: number
  observedQuantity: number
  scanned: boolean
  observed: boolean
  status: ItemStatus
  confidence: number
  firstSeen: number
  shelfId: string
}
export interface ItemReconciliationResult extends CartItemState {
  productName: string
  price: number
  reason?: string
}
export interface ReconciliationResult {
  sessionId: string
  itemResults: ItemReconciliationResult[]
  overallStatus: 'APPROVED' | 'PAYMENT_HELD' | 'EXCEPTION_REQUIRED' | 'REVIEW_REQUIRED'
  confidence: number
  reasons: string[]
}

export interface SessionState {
  id: string
  customerId: string
  startedAt: number
  exitState: 'READY' | 'APPROACHING' | 'RECONCILING' | 'APPROVED' | 'PAYMENT_HELD' | 'EXCEPTION_REQUIRED' | 'HUMAN_REVIEW' | 'CLOSED'
  reconciliation?: ReconciliationResult
}

export interface VisionFrame {
  timestamp: number
  cameraId: string
  trackId: string
  zone: string
  action: string
  personConfidence: number
  interactionConfidence: number
  productConfidence: number
  status: 'TRACKING' | 'INTERACTION' | 'UNCERTAIN' | 'COMPLETE'
}

export interface ShelfState {
  shelfId: string
  baselineWeight: number
  currentWeight: number
  delta: number
  sensorStatus: SensorStatus
  confidence: number
  movement: 'STABLE' | 'ITEM_REMOVED' | 'ITEM_RESTORED' | 'UNAVAILABLE'
  lastUpdated: number
}

export interface AppSnapshot {
  events: SimulationEvent[]
  result?: ReconciliationResult
  scenarioId?: string
  sessionId?: string
  capturedAt: number
}

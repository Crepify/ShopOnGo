import type { VisionFrame, SimulationEvent, ShelfState } from '../types'

// Provider boundaries intentionally contain no UI knowledge. Future adapters can
// translate OpenCV/WebRTC, hardware shelf, or FastAPI WebSocket messages here.
export interface VisionProvider {
  start(): void
  stop(): void
  getFrame(): VisionFrame | null
  subscribe(callback: (frame: VisionFrame) => void): () => void
}
export interface ShelfSensorProvider {
  start(): void
  stop(): void
  getShelfState(shelfId: string): ShelfState | undefined
  subscribe(callback: (event: ShelfEvent) => void): () => void
}
export interface MobileEventProvider {
  scanProduct(productId: string): void
  subscribe(callback: (event: MobileEvent) => void): () => void
}
export interface PaymentProvider {
  authorize(amount: number): Promise<{ approved: boolean; reference: string; message: string }>
}

export type VisionEvent = SimulationEvent
export type ShelfEvent = SimulationEvent
export type MobileEvent = SimulationEvent

export class SimulatedVisionProvider implements VisionProvider {
  private listeners = new Set<(frame: VisionFrame) => void>()
  private frame: VisionFrame | null = null
  private timer?: number
  start() { this.timer = window.setInterval(() => { if (this.frame) this.listeners.forEach((listener) => listener(this.frame!)) }, 250) }
  stop() { if (this.timer) window.clearInterval(this.timer) }
  getFrame() { return this.frame }
  setFrame(frame: VisionFrame) { this.frame = frame }
  subscribe(callback: (frame: VisionFrame) => void) { this.listeners.add(callback); return () => this.listeners.delete(callback) }
}

export class SimulatedShelfProvider implements ShelfSensorProvider {
  private state = new Map<string, ShelfState>()
  private listeners = new Set<(event: ShelfEvent) => void>()
  getShelfState(shelfId: string) { return this.state.get(shelfId) }
  setState(state: ShelfState) { this.state.set(state.shelfId, state) }
  start() {}
  stop() {}
  subscribe(callback: (event: ShelfEvent) => void) { this.listeners.add(callback); return () => this.listeners.delete(callback) }
}

export class SimulatedMobileProvider implements MobileEventProvider {
  private listeners = new Set<(event: MobileEvent) => void>()
  scanProduct(productId: string) { this.listeners.forEach((listener) => listener({ id: `mobile-${Date.now()}`, timestamp: Date.now(), scenarioId: 'manual', sessionId: 'manual', source: 'MOBILE', type: 'ITEM_SCANNED', productId, payload: {}, severity: 'INFO' })) }
  subscribe(callback: (event: MobileEvent) => void) { this.listeners.add(callback); return () => this.listeners.delete(callback) }
}

export class OpenCVVisionProvider implements VisionProvider {
  // TODO: connect a backend/WebRTC frame stream and normalize detections to VisionFrame.
  start() {}
  stop() {}
  getFrame() { return null }
  subscribe(_callback: (frame: VisionFrame) => void) { return () => undefined }
}
export class HardwareShelfProvider implements ShelfSensorProvider {
  // TODO: connect HX711/ESP32/RFID events through a backend adapter.
  start() {}
  stop() {}
  getShelfState(_shelfId: string) { return undefined }
  subscribe(_callback: (event: ShelfEvent) => void) { return () => undefined }
}
export class MockPaymentProvider implements PaymentProvider {
  async authorize(amount: number) { return { approved: amount > 0, reference: `SIM-${Math.floor(amount * 10)}-OK`, message: 'Simulation only — no payment was processed.' } }
}

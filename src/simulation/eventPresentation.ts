import { productById } from '../data/products'
import type { EventType, SimulationEvent } from '../types'

export interface AppNotification {
  id: string
  eventId: string
  title: string
  message: string
  tone: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  productId?: string
  timestamp: number
}

const productName = (productId?: string) => productId ? productById[productId]?.name ?? productId : 'item'

export function notificationForEvent(event: SimulationEvent): AppNotification | null {
  const name = productName(event.productId)
  const tone = event.severity
  const copy: Partial<Record<EventType, { title: string; message: string; tone?: AppNotification['tone'] }>> = {
    SESSION_STARTED: { title: 'Shopping session ready', message: 'Shop as usual. Your phone and the store are connected.' },
    CUSTOMER_APPROACHED_SHELF: { title: 'Shelf nearby', message: `You are near ${name}. Scan an item after picking it up.` },
    CAMERA_PICK_DETECTED: { title: 'Physical item detected', message: `${name} was observed near the shelf. Scan it to add it to your cart.`, tone: 'WARNING' },
    SHELF_WEIGHT_DECREASED: { title: 'Shelf signal received', message: `The shelf registered a physical movement for ${name}.`, tone: 'INFO' },
    ITEM_SCANNED: { title: 'Scan complete', message: `${name} was added to your declared cart.`, tone: 'SUCCESS' },
    ITEM_SCAN_DUPLICATED: { title: 'Duplicate scan detected', message: `${name} was scanned more than once. The cart needs a quantity check.`, tone: 'WARNING' },
    ITEM_MOVED_TO_BAG: { title: 'Visibility reduced', message: 'The physical item became unobservable in the bag zone. The system does not infer intent.', tone: 'WARNING' },
    CAMERA_RETURN_DETECTED: { title: 'Item return observed', message: `${name} was seen returning toward a shelf.`, tone: 'INFO' },
    SHELF_WEIGHT_RESTORED: { title: 'Shelf signal restored', message: `The shelf weight returned toward its baseline for ${name}.`, tone: 'SUCCESS' },
    SKU_MISMATCH: { title: 'Cart review required', message: `The phone declared a different product than the physical ${name}.`, tone: 'ERROR' },
    QUANTITY_MISMATCH: { title: 'Quantity review required', message: 'The declared quantity does not match the physical evidence.', tone: 'ERROR' },
    CAMERA_UNCERTAIN: { title: 'Camera visibility reduced', message: 'The interaction cannot be confirmed confidently. Human review is required.', tone: 'WARNING' },
    SENSOR_UNAVAILABLE: { title: 'Shelf signal unavailable', message: 'Checkout for this interaction is temporarily disabled while evidence is reviewed.', tone: 'ERROR' },
    ITEM_PROVISIONAL: { title: 'Verification required', message: `${name} was observed without a matching mobile declaration.`, tone: 'WARNING' },
    ITEM_UNVERIFIED: { title: 'Physical confirmation missing', message: `${name} was declared on the phone but not physically confirmed.`, tone: 'WARNING' },
    PAYMENT_APPROVED: { title: 'Transaction verified', message: 'Your declared cart matches the observed shopping journey.', tone: 'SUCCESS' },
    PAYMENT_HELD: { title: 'Payment held pending review', message: 'No real payment was processed. Please continue to the review point.', tone: 'ERROR' },
    EXCEPTION_CREATED: { title: 'Review point created', message: 'A neutral verification workflow is ready for this transaction.', tone: 'WARNING' },
    TRACK_ASSOCIATION_UNCERTAIN: { title: 'Customer association uncertain', message: 'The store could not confidently associate the item with one track.', tone: 'WARNING' },
    AUTOMATIC_CHECKOUT_DISABLED: { title: 'Automatic checkout paused', message: 'The affected shelf needs a human review before checkout can continue.', tone: 'ERROR' },
  }
  const selected = copy[event.type]
  if (!selected) return null
  return { id: `notification-${event.id}`, eventId: event.id, title: selected.title, message: selected.message, tone: selected.tone ?? tone, productId: event.productId, timestamp: event.timestamp }
}

export function notificationsForEvents(events: SimulationEvent[]): AppNotification[] {
  return events.map(notificationForEvent).filter((notification): notification is AppNotification => Boolean(notification))
}

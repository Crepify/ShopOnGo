import { describe, expect, it } from 'vitest'
import { scenarios } from '../data/scenarios'
import { hydrateEvent, createSession } from './replay'
import { notificationForEvent, notificationsForEvents } from './eventPresentation'

describe('shopper notifications', () => {
  it('turns a physical pickup into a neutral phone notification', () => {
    const scenario = scenarios.find((item) => item.id === 'normal-purchase')!
    const step = scenario.steps.find((item) => item.eventType === 'CAMERA_PICK_DETECTED')!
    const notification = notificationForEvent(hydrateEvent(step, scenario, createSession(scenario.id, 1000), 0))!
    expect(notification.title).toBe('Physical item detected')
    expect(notification.message).toContain('Scan it')
    expect(notification.tone).toBe('WARNING')
  })

  it('keeps notification ids tied to immutable event ids', () => {
    const scenario = scenarios.find((item) => item.id === 'product-swap')!
    const session = createSession(scenario.id, 1000)
    const events = scenario.steps.map((step, index) => hydrateEvent(step, scenario, session, index))
    const notifications = notificationsForEvents(events)
    expect(notifications.length).toBeGreaterThan(0)
    expect(new Set(notifications.map((item) => item.id)).size).toBe(notifications.length)
  })
})

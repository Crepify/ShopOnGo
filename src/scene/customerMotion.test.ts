import { describe, expect, it } from 'vitest'
import { scenarios } from '../data/scenarios'
import { deriveCustomerMotion } from './customerMotion'

describe('customer motion', () => {
  it('stops at the safe interaction point instead of crossing a shelf', () => {
    const scenario = scenarios.find((item) => item.id === 'normal-purchase')!
    const motion = deriveCustomerMotion(scenario, 3200, 'READY')
    expect(motion.phase).toBe('REACHING')
    expect(motion.position).toEqual(motion.interactionPoint)
    expect(motion.position[1]).toBe(0.18)
  })

  it('keeps declared and physical products separate for a swap journey', () => {
    const scenario = scenarios.find((item) => item.id === 'product-swap')!
    const motion = deriveCustomerMotion(scenario, 4700, 'READY')
    expect(motion.focusProductId).toBe('milk')
    expect(motion.carriedProductId).toBe('milk')
  })

  it('routes a held customer toward the review zone', () => {
    const scenario = scenarios.find((item) => item.id === 'pick-without-scan')!
    const motion = deriveCustomerMotion(scenario, 11200, 'PAYMENT_HELD')
    expect(motion.phase).toBe('WAITING_FOR_REVIEW')
    expect(motion.position[2]).toBeGreaterThan(1.2)
  })

  it('is deterministic while paused at the same simulation time', () => {
    const scenario = scenarios.find((item) => item.id === 'normal-purchase')!
    const first = deriveCustomerMotion(scenario, 4200, 'READY')
    const second = deriveCustomerMotion(scenario, 4200, 'READY')
    expect(second).toEqual(first)
  })
})

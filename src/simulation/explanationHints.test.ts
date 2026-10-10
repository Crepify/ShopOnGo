import { describe, expect, it } from 'vitest'
import { scenarios } from '../data/scenarios'
import { createSession, hydrateEvent } from './replay'
import { hintForEvent, hintForPhase } from './explanationHints'

describe('simulation explanation hints', () => {
  it('explains pickup using neutral evidence language', () => {
    const scenario = scenarios.find((item) => item.id === 'concealment')!
    const step = scenario.steps.find((item) => item.eventType === 'CAMERA_PICK_DETECTED')!
    const hint = hintForEvent(hydrateEvent(step, scenario, createSession(scenario.id, 100), 3))!
    expect(hint.title).toBe('Physical interaction detected')
    expect(hint.explanation).toContain('not an assumption about intent')
    expect(hint.anchor).toBe('CAMERA')
  })

  it('provides a guided hint for the phone scan phase', () => {
    const hint = hintForPhase('SCANNING')
    expect(hint?.anchor).toBe('PHONE')
    expect(hint?.whyItMatters).toContain('declaration')
  })
})

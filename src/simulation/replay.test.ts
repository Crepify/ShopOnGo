import { describe, expect, it } from 'vitest'
import { scenarios } from '../data/scenarios'
import { productById } from '../data/products'
import { shelfById } from '../data/shelves'
import { validateAllScenarios } from './validation'
import { expectedOverallStatus, narratedOutcome, replayScenario, scenarioDurationMs, scenarioPasses } from './replay'

describe('scenario library invariants', () => {
  it('references only known products and shelves', () => {
    expect(validateAllScenarios(scenarios).filter((entry) => !entry.valid)).toEqual([])
  })

  it('derives metadata from the authored steps', () => {
    for (const scenario of scenarios) {
      expect(scenario.eventsCount, scenario.id).toBe(scenario.steps.length)
      expect(scenario.durationSeconds, scenario.id).toBe(Math.ceil(scenarioDurationMs(scenario) / 1000))
    }
  })

  it('keeps steps ordered, uniquely identified, and inside the run window', () => {
    for (const scenario of scenarios) {
      const ids = scenario.steps.map((step) => step.id)
      expect(new Set(ids).size, scenario.id).toBe(ids.length)
      let previous = -1
      for (const step of scenario.steps) {
        expect(step.delayMs, `${scenario.id}/${step.id}`).toBeGreaterThanOrEqual(previous)
        expect(step.delayMs, `${scenario.id}/${step.id}`).toBeLessThanOrEqual(scenarioDurationMs(scenario))
        previous = step.delayMs
      }
      expect(scenario.steps[0].delayMs, scenario.id).toBe(0)
    }
  })

  it('declares an outcome in the vocabulary the engine produces', () => {
    for (const scenario of scenarios) expect(expectedOverallStatus(scenario), scenario.id).toBeDefined()
  })

  it('replays to the declared outcome', () => {
    for (const scenario of scenarios) {
      const { result } = replayScenario(scenario)
      expect(result.overallStatus, scenario.id).toBe(expectedOverallStatus(scenario))
      expect(scenarioPasses(scenario, result), scenario.id).toBe(true)
    }
  })

  it('agrees with the checkout events it emits', () => {
    for (const scenario of scenarios) {
      const { events, result } = replayScenario(scenario)
      expect(result.overallStatus, scenario.id).toBe(narratedOutcome(events))
    }
  })

  it('surfaces evidence confidence instead of a flat default', () => {
    const confidenceOf = (scenarioId: string, productId: string) => {
      const scenario = scenarios.find((entry) => entry.id === scenarioId)!
      return replayScenario(scenario).result.itemResults.find((item) => item.productId === productId)?.confidence
    }
    expect(confidenceOf('normal-purchase', 'coffee')).toBe(0.94)
    expect(confidenceOf('camera-occlusion', 'coffee')).toBe(0.39)
    expect(confidenceOf('group-handoff', 'pasta')).toBe(0.62)
    expect(confidenceOf('wrong-shelf-return', 'soap')).toBe(0.79)
    expect(confidenceOf('product-swap', 'milk')).toBe(0.91)
    // A sensor that stopped reporting cannot support any confidence in shelf evidence.
    expect(confidenceOf('sensor-failure', 'milk')).toBe(0)
  })

  it('counts a second observed unit once', () => {
    const scenario = scenarios.find((entry) => entry.id === 'multiple-item-mismatch')!
    const item = replayScenario(scenario).result.itemResults[0]
    expect(item.observedQuantity).toBe(2)
    expect(item.scannedQuantity).toBe(1)
    expect(item.quantity).toBe(2)
    expect(item.status).toBe('QUANTITY_MISMATCH')
  })

  it('attributes shelf-scoped sensor events to the affected cart line', () => {
    const scenario = scenarios.find((entry) => entry.id === 'sensor-failure')!
    const { events, result } = replayScenario(scenario)
    expect(events.some((event) => event.type === 'SENSOR_UNAVAILABLE' && !event.productId)).toBe(true)
    expect(result.itemResults[0].status).toBe('SENSOR_UNAVAILABLE')
    expect(result.overallStatus).toBe('PAYMENT_HELD')
  })

  it('would fail a scenario whose expected outcome disagrees with the engine', () => {
    const [scenario] = scenarios
    const { result } = replayScenario(scenario)
    expect(scenarioPasses({ ...scenario, expectedOutcome: 'CONFIRMED → PAYMENT_HELD' }, result)).toBe(false)
    expect(scenarioPasses(scenario, undefined)).toBe(false)
  })

  it('keeps every referenced shelf/product pair consistent with the catalog', () => {
    for (const scenario of scenarios) {
      for (const step of scenario.steps) {
        if (!step.productId) continue
        const product = productById[step.productId]
        expect(product, `${scenario.id}/${step.id}`).toBeDefined()
        if (step.shelfId) expect(shelfById[step.shelfId], `${scenario.id}/${step.id}`).toBeDefined()
      }
    }
  })
})

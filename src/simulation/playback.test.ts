import { beforeEach, describe, expect, it } from 'vitest'
import { scenarioById, scenarios } from '../data/scenarios'
import { shelves } from '../data/shelves'
import { useSimulationStore } from '../stores/simulationStore'
import { replayScenario, scenarioDurationMs } from './replay'
import { deriveShelfState } from './shelfState'

const store = () => useSimulationStore.getState()
/** Session ids and first-seen stamps carry the wall clock; compare the reconciliation itself. */
const shape = (result: ReturnType<typeof replayScenario>['result']) => ({ ...result, sessionId: 'run', itemResults: result.itemResults.map(({ firstSeen, ...item }) => item) })

describe('playback runtime', () => {
  beforeEach(() => { store().launchScenario('normal-purchase'); store().reset() })

  it('emits exactly one event per manual step at any playback speed', () => {
    for (const speed of [0.5, 1, 2, 8]) {
      store().launchScenario('normal-purchase')
      store().setSpeed(speed)
      for (let expected = 1; expected <= 6; expected += 1) {
        store().step()
        expect(store().events.length, `speed ${speed}`).toBe(expected)
        expect(store().status, `speed ${speed}`).toBe('PAUSED')
      }
    }
  })

  it('runs to completion and freezes on the final event', () => {
    const scenario = scenarios[0]
    store().start()
    for (let index = 0; index < 400; index += 1) store().tick(100)
    const finished = store()
    expect(finished.status).toBe('COMPLETE')
    expect(finished.events.length).toBe(scenario.eventsCount)
    expect(finished.elapsedMs).toBe(scenarioDurationMs(scenario))
    for (let index = 0; index < 10; index += 1) store().tick(1000)
    expect(store().elapsedMs).toBe(scenarioDurationMs(scenario))
    expect(store().events.length).toBe(scenario.eventsCount)
  })

  it('replays from the beginning when started again after completion', () => {
    store().start()
    for (let index = 0; index < 400; index += 1) store().tick(100)
    expect(store().status).toBe('COMPLETE')
    store().start()
    expect(store().status).toBe('RUNNING')
    expect(store().events).toEqual([])
    expect(store().elapsedMs).toBe(0)
    for (let index = 0; index < 400; index += 1) store().tick(100)
    expect(store().events.length).toBe(scenarios[0].eventsCount)
  })

  it('halts on stop without discarding the evidence already emitted', () => {
    store().start()
    for (let index = 0; index < 40; index += 1) store().tick(100)
    const emitted = store().events.length
    store().stop()
    for (let index = 0; index < 10; index += 1) store().tick(100)
    expect(store().status).toBe('STOPPED')
    expect(store().events.length).toBe(emitted)
  })

  it('accumulates the same evidence the offline replay produces', () => {
    for (const scenario of scenarios) {
      store().launchScenario(scenario.id)
      store().start()
      for (let index = 0; index < 400; index += 1) store().tick(100)
      const live = store()
      const offline = replayScenario(scenario)
      expect(live.events.map((event) => event.type), scenario.id).toEqual(offline.events.map((event) => event.type))
      expect(live.events.map((event) => event.confidence), scenario.id).toEqual(offline.events.map((event) => event.confidence))
      expect(shape(live.result!), scenario.id).toEqual(shape(offline.result))
      expect(live.session.exitState, scenario.id).toBe(offline.session.exitState)
    }
  })

  it('re-reconciles the stream when an operator scan is appended', () => {
    store().launchScenario('pick-without-scan')
    store().start()
    for (let index = 0; index < 400; index += 1) store().tick(100)
    expect(store().result?.overallStatus).toBe('EXCEPTION_REQUIRED')
    expect(store().result?.itemResults[0].status).toBe('PROVISIONAL')
    store().appendOperatorEvent('ITEM_SCANNED', { productId: 'milk', shelfId: 'shelf-01' })
    expect(store().result?.itemResults[0].status).toBe('CONFIRMED')
    // The exception already recorded in the ledger is not erased by a later scan.
    expect(store().result?.overallStatus).toBe('EXCEPTION_REQUIRED')
    expect(store().events.length).toBe(scenarioById['pick-without-scan'].eventsCount + 1)
  })
})

describe('shelf state derivation', () => {
  it('reports a real weight delta for a removed product', () => {
    const scenario = scenarioById['normal-purchase']
    const state = deriveShelfState(shelves[0], replayScenario(scenario).events)
    expect(state.movement).toBe('ITEM_REMOVED')
    expect(state.delta).toBe(-0.42) // coffee weighs 420 g
    expect(state.currentWeight).toBe(7.98)
    expect(state.sensorStatus).toBe('ONLINE')
    expect(state.confidence).toBe(0.95)
  })

  it('stays at baseline when a shelf is untouched', () => {
    const state = deriveShelfState(shelves[3], replayScenario(scenarioById['normal-purchase']).events)
    expect(state.delta).toBe(0)
    expect(state.currentWeight).toBe(shelves[3].baselineWeight)
    expect(state.movement).toBe('STABLE')
  })

  it('returns to baseline after a restored item', () => {
    const state = deriveShelfState(shelves[2], replayScenario(scenarioById['return-after-scan']).events)
    expect(state.delta).toBe(0)
    expect(state.movement).toBe('ITEM_RESTORED')
  })

  it('goes offline with no confidence when the sensor stops reporting', () => {
    const state = deriveShelfState(shelves[0], replayScenario(scenarioById['sensor-failure']).events)
    expect(state.sensorStatus).toBe('OFFLINE')
    expect(state.movement).toBe('UNAVAILABLE')
    expect(state.confidence).toBe(0)
  })

  it('counts both units of a two-unit removal', () => {
    const state = deriveShelfState(shelves[3], replayScenario(scenarioById['multiple-item-mismatch']).events)
    expect(state.delta).toBe(-0.18) // two 90 g bars
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { scenarioById } from '../data/scenarios'
import { useSimulationStore } from '../stores/simulationStore'
import { guidedScanner, SCAN_DURATION_MS } from './scanner'

describe('interactive scanner', () => {
  beforeEach(() => { useSimulationStore.getState().launchScenario('normal-purchase'); useSimulationStore.getState().setInteractionMode('GUIDED'); useSimulationStore.getState().reset() })
  it('shows a guided scanner before an authored mobile event', () => {
    const scenario = scenarioById['normal-purchase']
    const scan = guidedScanner(scenario, 4400, [])
    expect(scan?.productId).toBe('coffee')
    expect(scan?.progress).toBeGreaterThan(0)
    expect(scan?.progress).toBeLessThan(1)
  })

  it('reaches a completed scan at the configured duration', () => {
    const scenario = scenarioById['normal-purchase']
    const scan = guidedScanner(scenario, 5000, [])
    expect(scan).toBeUndefined()
    expect(SCAN_DURATION_MS).toBe(1200)
  })

  it('lets interactive mode scan a selected product exactly once', () => {
    const store = useSimulationStore.getState()
    store.launchScenario('normal-purchase')
    store.setInteractionMode('INTERACTIVE')
    store.start()
    for (let index = 0; index < 40; index += 1) store.tick(100)
    expect(useSimulationStore.getState().awaitingScanStepId).toBeDefined()
    store.beginScan('coffee')
    for (let index = 0; index < 20; index += 1) store.tick(100)
    const scans = useSimulationStore.getState().events.filter((event) => event.type === 'ITEM_SCANNED')
    expect(scans).toHaveLength(1)
    expect(scans[0].source).toBe('MOBILE')
    expect(useSimulationStore.getState().pendingScan).toBeUndefined()
    useSimulationStore.getState().setInteractionMode('GUIDED')
  })
})

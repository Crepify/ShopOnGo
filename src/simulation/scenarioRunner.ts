import type { Scenario, SimulationEvent } from '../types'

// UI-free runner contract. The Zustand store is the browser runtime; this small
// class is useful for a future worker, integration test, or backend adapter.
export class ScenarioRunner {
  private scenario?: Scenario
  private stepIndex = 0
  private listeners = new Set<(event: SimulationEvent) => void>()
  loadScenario(scenario: Scenario) { this.scenario = scenario; this.stepIndex = 0 }
  start() { this.stepIndex = 0 }
  pause() {}
  resume() {}
  stop() {}
  reset() { this.stepIndex = 0 }
  step() { return this.scenario?.steps[this.stepIndex++] }
  setSpeed(_speed: number) {}
  subscribe(listener: (event: SimulationEvent) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
}

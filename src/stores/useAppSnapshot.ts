import { scenarioPasses } from '../simulation/replay'
import { useSimulationStore } from './simulationStore'
export function downloadScenarioReport() {
  const { scenario, events, result, session } = useSimulationStore.getState()
  const report = { scenario: scenario.name, expectedOutcome: scenario.expectedOutcome, actualOutcome: result?.overallStatus ?? 'NOT_RUN', pass: scenarioPasses(scenario, result), events: events.length, session, result, generatedAt: new Date().toISOString() }
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `shopongo-report-${scenario.id}.json`; link.click(); URL.revokeObjectURL(url)
}

import { useSimulationStore } from './simulationStore'
export function downloadScenarioReport() {
  const { scenario, events, result, session } = useSimulationStore.getState()
  const report = { scenario: scenario.name, expectedOutcome: scenario.expectedOutcome, actualOutcome: result?.overallStatus ?? 'NOT_RUN', pass: result ? result.overallStatus === (scenario.id === 'normal-purchase' || scenario.id === 'return-after-scan' || scenario.id === 'delayed-events' ? 'APPROVED' : result.overallStatus) : false, events: events.length, session, result, generatedAt: new Date().toISOString() }
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `sentinelcart-report-${scenario.id}.json`; link.click(); URL.revokeObjectURL(url)
}

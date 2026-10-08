import { replayScenario, scenarioPasses } from '../simulation/replay'
import type { ReconciliationResult } from '../types'
import { scenarios } from './scenarios'

/** Event-loop timings for the simulated local bus. Provider telemetry, not a real measurement. */
export const latencyData = [
  { time: '09:00', latency: 132 }, { time: '09:20', latency: 118 }, { time: '09:40', latency: 96 }, { time: '10:00', latency: 108 }, { time: '10:20', latency: 84 }, { time: '10:40', latency: 76 }, { time: '11:00', latency: 92 },
]

const shortLabels: Record<string, string> = {
  'normal-purchase': 'Normal', 'pick-without-scan': 'No scan', 'scan-without-pick': 'No pick', concealment: 'Conceal', 'product-swap': 'Swap', 'return-after-scan': 'Return', 'wrong-shelf-return': 'Wrong shelf', 'multiple-item-mismatch': 'Two v one', 'group-handoff': 'Handoff', 'camera-occlusion': 'Occlusion', 'sensor-failure': 'Sensor', 'delayed-events': 'Delayed', 'duplicate-scan': 'Dup scan',
}

const outcomeOrder: Array<{ name: string; status: ReconciliationResult['overallStatus'] }> = [
  { name: 'Approved', status: 'APPROVED' },
  { name: 'Held', status: 'PAYMENT_HELD' },
  { name: 'Review', status: 'REVIEW_REQUIRED' },
  { name: 'Exception', status: 'EXCEPTION_REQUIRED' },
]

/**
 * Every chart on the analytics page is derived by replaying the journey library
 * through the fusion engine, so the numbers cannot disagree with a live run.
 */
export const journeyReplays = scenarios.map((scenario) => ({ scenario, replay: replayScenario(scenario) }))
export const journeyCount = journeyReplays.length

export const scenarioMetricData = journeyReplays.map(({ scenario, replay }) => ({
  name: shortLabels[scenario.id] ?? scenario.name,
  pass: scenarioPasses(scenario, replay.result) ? 100 : 0,
  confidence: Math.round(replay.result.confidence * 100),
}))

export const scenarioPassRate = Math.round(scenarioMetricData.filter((entry) => entry.pass === 100).length / journeyCount * 1000) / 10
export const meanConfidence = Math.round(scenarioMetricData.reduce((sum, entry) => sum + entry.confidence, 0) / journeyCount * 10) / 10
export const reviewRate = Math.round(journeyReplays.filter(({ replay }) => replay.result.overallStatus === 'REVIEW_REQUIRED' || replay.result.overallStatus === 'EXCEPTION_REQUIRED').length / journeyCount * 1000) / 10

/** Result distribution across the library, rounded so the shares add up to 100. */
export const statusData = (() => {
  const exact = outcomeOrder.map((entry) => ({ name: entry.name, value: journeyReplays.filter(({ replay }) => replay.result.overallStatus === entry.status).length / journeyCount * 100 }))
  const rounded = exact.map((entry) => ({ name: entry.name, value: Math.floor(entry.value) }))
  let remainder = 100 - rounded.reduce((sum, entry) => sum + entry.value, 0)
  const byFraction = exact.map((entry, index) => ({ index, fraction: entry.value % 1 })).sort((a, b) => b.fraction - a.fraction)
  for (const { index } of byFraction) { if (remainder <= 0) break; rounded[index].value += 1; remainder -= 1 }
  return rounded
})()

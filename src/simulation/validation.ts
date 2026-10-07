import { productById } from '../data/products'
import { shelfById } from '../data/shelves'
import type { Scenario } from '../types'

export function validateScenario(scenario: Scenario) {
  const errors: string[] = []
  if (!scenario.expectedOutcome) errors.push('Expected outcome is required.')
  if (!scenario.steps.length) errors.push('Scenario must produce at least one event.')
  scenario.steps.forEach((step) => {
    if (step.productId && !productById[step.productId]) errors.push(`Missing product reference: ${step.productId}`)
    if (step.shelfId && !shelfById[step.shelfId]) errors.push(`Missing shelf reference: ${step.shelfId}`)
    if (step.delayMs < 0) errors.push(`Negative delay: ${step.id}`)
  })
  return { valid: errors.length === 0, errors }
}
export function validateAllScenarios(scenarios: Scenario[]) { return scenarios.map((scenario) => ({ scenarioId: scenario.id, ...validateScenario(scenario) })) }

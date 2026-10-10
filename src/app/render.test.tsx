import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { useSimulationStore } from '../stores/simulationStore'
import { scenarioById } from '../data/scenarios'
import { shelfMovementLabel } from '../components/sensors/ShelfSensors'

// Components that only read the stores can be rendered to markup, which catches
// render-time crashes (missing products, undefined confidence, empty item lists)
// that unit tests on the engine would miss.

// react-router uses useLayoutEffect, which React warns about when rendered to a string.
const realConsoleError = console.error.bind(console)
beforeAll(() => { console.error = (...args: unknown[]) => { if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return; realConsoleError(...args) } })
afterAll(() => { console.error = realConsoleError })
function render(ui: React.ReactElement) {
  return renderToStaticMarkup(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('panel rendering', () => {
  it('renders every scenario panel set without crashing', async () => {
    const { ShelfSensors } = await import('../components/sensors/ShelfSensors')
    const { VirtualCart } = await import('../components/cart/VirtualCart')
    const { MobilePhone } = await import('../components/mobile/MobilePhone')
    const { CameraFeed } = await import('../components/camera/CameraFeed')
    const { EventTimeline } = await import('../components/timeline/EventTimeline')
    for (const scenario of Object.values(scenarioById)) {
      useSimulationStore.getState().launchScenario(scenario.id)
      useSimulationStore.getState().start()
      for (let index = 0; index < 400; index += 1) useSimulationStore.getState().tick(100)
       const markup = render(<div><ShelfSensors /><VirtualCart detailed /><MobilePhone /><CameraFeed /><EventTimeline /></div>)
      expect(markup.length, scenario.id).toBeGreaterThan(500)
      expect(markup, scenario.id).not.toContain('undefined')
      expect(markup, scenario.id).not.toContain('NaN')
    }
  })

  it('renders the analytics and ledger pages', async () => {
    const { AnalyticsPage } = await import('../pages/AnalyticsPage')
    const { EventsPage } = await import('../pages/EventsPage')
    const { SimulatorPage } = await import('../pages/SimulatorPage')
    expect(render(<AnalyticsPage />)).toContain('Simulation analytics')
    expect(render(<EventsPage />)).toContain('Event ledger')
    expect(render(<SimulatorPage />)).toContain('Choose a verification journey')
  })

  it('labels every shelf movement state', () => {
    expect(Object.keys(shelfMovementLabel).sort()).toEqual(['ITEM_REMOVED', 'ITEM_RESTORED', 'STABLE', 'UNAVAILABLE'])
    expect(shelfMovementLabel.ITEM_REMOVED).toBe('ITEM REMOVED')
  })
})

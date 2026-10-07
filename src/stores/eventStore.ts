import { create } from 'zustand'
import type { EventSource, Severity } from '../types'

export type EventFilter = 'ALL' | EventSource | 'WARNINGS' | 'ERRORS'
interface EventStore { filter: EventFilter; setFilter: (filter: EventFilter) => void; exportJson: (events: unknown[]) => void }
export const useEventStore = create<EventStore>((set) => ({
  filter: 'ALL',
  setFilter: (filter) => set({ filter }),
  exportJson: (events) => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `shopongo-events-${Date.now()}.json`; anchor.click(); URL.revokeObjectURL(url)
  },
}))
export const severityRank: Record<Severity, number> = { INFO: 0, SUCCESS: 1, WARNING: 2, ERROR: 3 }

import type { Shelf } from '../types'

export const shelves: Shelf[] = [
  { id: 'shelf-01', name: 'Aisle 01 · Essentials', position: [-5.1, 0, -2.35], rotation: 0, productIds: ['coffee', 'milk'], baselineWeight: 8.4, currentWeight: 8.4, sensorStatus: 'ONLINE' },
  { id: 'shelf-02', name: 'Aisle 02 · Snacks', position: [-1.35, 0, -2.35], rotation: 0, productIds: ['chips', 'cereal'], baselineWeight: 6.75, currentWeight: 6.75, sensorStatus: 'ONLINE' },
  { id: 'shelf-03', name: 'Aisle 03 · Home care', position: [2.45, 0, -2.35], rotation: 0, productIds: ['juice', 'soap'], baselineWeight: 7.15, currentWeight: 7.15, sensorStatus: 'ONLINE' },
  { id: 'shelf-04', name: 'Aisle 04 · Pantry', position: [5.35, 0, 0.65], rotation: Math.PI / 2, productIds: ['chocolate', 'pasta'], baselineWeight: 5.9, currentWeight: 5.9, sensorStatus: 'ONLINE' },
]

export const shelfById = Object.fromEntries(shelves.map((shelf) => [shelf.id, shelf])) as Record<string, Shelf>

import type { SimulatedCamera } from '../types'

export const cameras: SimulatedCamera[] = [
  { id: 'camera-01', name: 'Camera 01 · Entry', position: [-7, 5.6, 3.2], target: [-3, 0, 0], coverageZoneIds: ['entry', 'aisle-01'], status: 'ONLINE' },
  { id: 'camera-02', name: 'Camera 02 · Aisle', position: [0, 5.8, -4.6], target: [0, 0, -1.8], coverageZoneIds: ['aisle-01', 'aisle-02', 'bag-zone'], status: 'ONLINE' },
  { id: 'camera-03', name: 'Camera 03 · Exit', position: [7.2, 4.5, 2.8], target: [6.3, 0, 0], coverageZoneIds: ['exit', 'review-zone'], status: 'ONLINE' },
]

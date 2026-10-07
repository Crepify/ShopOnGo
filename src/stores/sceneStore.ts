import { create } from 'zustand'
export type CameraMode = 'OPERATOR' | 'CUSTOMER_FOLLOW' | 'CAMERA_01' | 'CAMERA_02' | 'EXIT_CAMERA'
interface SceneStore { cameraMode: CameraMode; selectedObject?: string; showLabels: boolean; setCameraMode: (mode: CameraMode) => void; setSelectedObject: (id?: string) => void; setShowLabels: (show: boolean) => void }
export const useSceneStore = create<SceneStore>((set) => ({ cameraMode: 'OPERATOR', showLabels: true, setCameraMode: (cameraMode) => set({ cameraMode }), setSelectedObject: (selectedObject) => set({ selectedObject }), setShowLabels: (showLabels) => set({ showLabels }) }))

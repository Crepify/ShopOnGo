import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, Text } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import { Group, Vector3 } from 'three'
import { cameras } from '../data/cameras'
import { productById, products } from '../data/products'
import { shelves } from '../data/shelves'
import { deriveCustomerMotion } from './customerMotion'
import { useSceneStore } from '../stores/sceneStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useSimulationStore } from '../stores/simulationStore'

const floorColor = '#17171c'

function SceneCameraController() {
  const { camera } = useThree()
  const mode = useSceneStore((state) => state.cameraMode)
  const elapsed = useSimulationStore((state) => state.elapsedMs)
  const scenario = useSimulationStore((state) => state.scenario)
  const exitState = useSimulationStore((state) => state.session.exitState)
  const target = useMemo(() => new Vector3(), [])
  const desiredPosition = useMemo(() => new Vector3(), [])
  const desiredLook = useMemo(() => new Vector3(), [])
  useFrame((_, delta) => {
    if (mode === 'OPERATOR') return
    const motion = deriveCustomerMotion(scenario, elapsed, exitState)
    if (mode === 'CUSTOMER_FOLLOW') {
      const facing = new Vector3(Math.sin(motion.heading), 0, Math.cos(motion.heading))
      desiredPosition.set(motion.position[0] - facing.x * 3.2, 3.15, motion.position[2] - facing.z * 3.2)
      desiredLook.set(motion.position[0], 0.85, motion.position[2])
    } else if (mode === 'CAMERA_01') {
      desiredPosition.set(-7, 5.6, 3.2); desiredLook.set(-3, 0, 0)
    } else if (mode === 'CAMERA_02') {
      desiredPosition.set(0, 5.8, -4.6); desiredLook.set(0, 0, -1.8)
    } else {
      desiredPosition.set(7.2, 4.5, 2.8); desiredLook.set(6.3, 0, 0)
    }
    camera.position.lerp(desiredPosition, Math.min(1, delta * 2.5)); target.lerp(desiredLook, Math.min(1, delta * 2.5)); camera.lookAt(target)
  })
  return null
}

function Floor() {
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}><planeGeometry args={[18, 12]} /><meshStandardMaterial color={floorColor} roughness={0.86} /></mesh>
    <gridHelper args={[18, 18, '#42232a', '#25252c']} position={[0, 0.01, 0]} />
    <mesh position={[0, 2.7, -5.7]}><boxGeometry args={[18, 5.4, 0.18]} /><meshStandardMaterial color="#111116" /></mesh>
    <mesh position={[-8.8, 2.7, 0]}><boxGeometry args={[0.18, 5.4, 12]} /><meshStandardMaterial color="#111116" /></mesh>
    <mesh position={[8.8, 2.7, 0]}><boxGeometry args={[0.18, 5.4, 12]} /><meshStandardMaterial color="#111116" /></mesh>
  </>
}

function ShelfModel({ shelfId, name, position, rotation }: { shelfId: string; name: string; position: [number, number, number]; rotation: number }) {
  const selected = useSceneStore((state) => state.selectedObject === shelfId)
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  const shelf = shelves.find((item) => item.id === shelfId)!
  return <group position={position} rotation={[0, rotation, 0]} onClick={(event) => { event.stopPropagation(); setSelectedObject(shelfId) }}>
    <mesh position={[0, 0.15, 0]}><boxGeometry args={[3.1, 0.22, 0.75]} /><meshStandardMaterial color={selected ? '#8f2033' : '#292930'} emissive={selected ? '#5c1423' : '#101014'} emissiveIntensity={0.6} /></mesh>
    <mesh position={[0, 1.1, 0]}><boxGeometry args={[3.1, 0.08, 0.72]} /><meshStandardMaterial color="#45454e" /></mesh>
    <mesh position={[0, 2.08, 0]}><boxGeometry args={[3.1, 0.08, 0.72]} /><meshStandardMaterial color="#45454e" /></mesh>
    {[-1.45, 1.45].map((x) => <mesh key={x} position={[x, 1.15, 0]}><boxGeometry args={[0.1, 2.3, 0.72]} /><meshStandardMaterial color="#555560" /></mesh>)}
    <Text position={[0, 2.48, 0]} fontSize={0.16} color={selected ? '#ff9aa5' : '#d1d1d7'} anchorX="center" anchorY="middle">{name.replace('Aisle ', '')}</Text>
    <Html position={[0, -0.02, 0.42]} center distanceFactor={11} style={{ pointerEvents: 'none' }}><span className="scene-tag">{shelfId.toUpperCase()}</span></Html>
  </group>
}

function ProductVisual({ productId, dimensions, color, selected = false, label = false }: { productId: string; dimensions: [number, number, number]; color: string; selected?: boolean; label?: boolean }) {
  const isCylinder = productId === 'milk' || productId === 'juice'
  return <>
    <mesh><boxGeometry args={selected || isCylinder ? [dimensions[0] * 1.1, dimensions[1] * 1.1, dimensions[2] * 1.1] : dimensions} /><meshStandardMaterial color={selected ? '#ff5263' : color} emissive={selected ? '#c71934' : color} emissiveIntensity={selected ? 0.65 : 0.12} roughness={0.62} /></mesh>
    <mesh position={[0, 0, dimensions[2] / 2 + 0.009]}><planeGeometry args={[Math.min(dimensions[0] * 0.82, 0.5), Math.min(dimensions[1] * 0.35, 0.28)]} /><meshBasicMaterial color="#eaf6f7" transparent opacity={0.72} /></mesh>
    {label && <Html position={[0, Math.max(0.45, dimensions[1]), 0]} center distanceFactor={9}><span className="scene-product-label">{productById[productId].name}</span></Html>}
  </>
}

function ProductModel({ productId, position, rotationY = 0, dimensions, color, carried = false }: { productId: string; position: [number, number, number]; rotationY?: number; dimensions: [number, number, number]; color: string; carried?: boolean }) {
  const selected = useSceneStore((state) => state.selectedObject === productId)
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  return <group visible={!carried} position={position} rotation={[0, rotationY, 0]} onClick={(event) => { event.stopPropagation(); setSelectedObject(productId) }}>
    <ProductVisual productId={productId} dimensions={dimensions} color={color} selected={selected} label={selected} />
  </group>
}

function CustomerModel() {
  const group = useRef<Group>(null)
  const elapsed = useSimulationStore((state) => state.elapsedMs)
  const status = useSimulationStore((state) => state.status)
  const scenario = useSimulationStore((state) => state.scenario)
  const exitState = useSimulationStore((state) => state.session.exitState)
  const selected = useSceneStore((state) => state.selectedObject === 'person_01')
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  const motion = deriveCustomerMotion(scenario, elapsed, exitState)
  const reach = motion.reachProgress
  const isReaching = motion.phase === 'REACHING'
  const isScanning = motion.phase === 'SCANNING'
  const isPlacing = motion.phase === 'PLACING_IN_BAG'
  const isWaiting = motion.phase === 'WAITING_FOR_REVIEW'
  const heading = useRef(motion.heading)
  useFrame((_, delta) => {
    if (!group.current) return
    group.current.position.x = motion.position[0]
    group.current.position.y = motion.position[1] + (status === 'RUNNING' ? Math.sin(elapsed / 150) * 0.025 : 0)
    group.current.position.z = motion.position[2]
    // shortest-path turn towards the walking direction
    const turn = ((motion.heading - heading.current + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
    heading.current += turn * Math.min(1, delta * 4)
    group.current.rotation.y = heading.current
  })
  const leftArmPosition: [number, number, number] = [-0.18, 0.72 + reach * 0.2, -reach * 0.24]
  const rightArmPosition: [number, number, number] = [0.18, 0.72 + reach * 0.2, -reach * 0.24]
  return <group ref={group} position={motion.position} onClick={(event) => { event.stopPropagation(); setSelectedObject('person_01') }}>
    <mesh position={[0, 0.75, 0]}><capsuleGeometry args={[0.27, 0.58, 4, 8]} /><meshStandardMaterial color={selected ? '#ff5263' : '#45454e'} emissive={selected ? '#c71934' : '#202027'} emissiveIntensity={selected ? 0.7 : 0.3} /></mesh>
    <mesh position={[0, 1.55, 0]} rotation={[0, isReaching || isScanning ? -0.18 : 0, 0]}><sphereGeometry args={[0.3, 12, 8]} /><meshStandardMaterial color="#e4b59b" /></mesh>
    <mesh position={[0, 0.25, -0.13]} rotation={[-0.25, 0, 0]}><boxGeometry args={[0.5, 0.35, 0.18]} /><meshStandardMaterial color="#d0a65c" /></mesh>
    <mesh position={leftArmPosition} rotation={[reach * 0.85, 0, 0.2 - reach * 0.62]}><capsuleGeometry args={[0.07, 0.45, 4, 6]} /><meshStandardMaterial color="#e4b59b" /></mesh>
    <mesh position={rightArmPosition} rotation={[reach * 0.85, 0, -0.2 + reach * 0.62]}><capsuleGeometry args={[0.07, 0.45, 4, 6]} /><meshStandardMaterial color="#e4b59b" /></mesh>
    {motion.carriedProductId && (!motion.itemInBag || motion.placementProgress < 0.98) && <group position={motion.itemInBag ? [0.05, 0.43 - motion.placementProgress * 0.22, -0.05] : [0.31, 0.95, -0.3]} rotation={[0, 0.25, 0]}><ProductVisual productId={motion.carriedProductId} dimensions={productById[motion.carriedProductId].dimensions} color={productById[motion.carriedProductId].color} label={selected} /></group>}
    {(isScanning || motion.phoneActive) && <mesh position={[0.28, 0.9, -0.32]} rotation={[0.25, 0.1, 0]}><boxGeometry args={[0.15, 0.25, 0.025]} /><meshStandardMaterial color="#d9fbff" emissive="#2ed5e1" emissiveIntensity={1.4} /></mesh>}
    {(isReaching || isPlacing || isWaiting) && <Html position={[0, 2.12, 0]} center distanceFactor={9}><span className={`scene-action-label ${isWaiting ? 'review' : ''}`}>{isWaiting ? 'REVIEW POINT' : isPlacing ? 'BAGGING' : reach < .5 ? 'REACHING' : 'PICKUP'}</span></Html>}
    <Html position={[0, 2.05, 0]} center distanceFactor={9}><span className="scene-track-label">TRACK_ID · person_01</span></Html>
  </group>
}

function ExitGate() {
  const selected = useSceneStore((state) => state.selectedObject === 'exit-01')
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  const exitState = useSimulationStore((state) => state.session.exitState)
  const color = exitState === 'APPROVED' ? '#4ff0a6' : ['PAYMENT_HELD', 'EXCEPTION_REQUIRED', 'HUMAN_REVIEW'].includes(exitState) ? '#ffb34d' : '#ff3048'
  return <group position={[6.8, 0, 1.2]} onClick={(event) => { event.stopPropagation(); setSelectedObject('exit-01') }}>
    <mesh position={[-0.9, 1.25, 0]}><boxGeometry args={[0.18, 2.5, 0.42]} /><meshStandardMaterial color="#2e5364" /></mesh>
    <mesh position={[0.9, 1.25, 0]}><boxGeometry args={[0.18, 2.5, 0.42]} /><meshStandardMaterial color="#2e5364" /></mesh>
    <mesh position={[0, 2.42, 0]}><boxGeometry args={[1.98, 0.18, 0.42]} /><meshStandardMaterial color="#2e5364" /></mesh>
    <mesh position={[0, 2.36, 0.24]}><boxGeometry args={[1.55, 0.05, 0.03]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} /></mesh>
    <Text position={[0, 2.9, 0]} fontSize={0.22} color={selected ? '#ffffff' : color} anchorX="center">EXIT GATE</Text>
    <Html position={[0, 1.7, 0.32]} center distanceFactor={8}><span className="scene-tag scene-tag-exit">{exitState.replace('_', ' ')}</span></Html>
  </group>
}

function CameraModel({ id, name, position }: { id: string; name: string; position: [number, number, number] }) {
  const setCameraMode = useSceneStore((state) => state.setCameraMode)
  return <group position={position} onClick={(event) => { event.stopPropagation(); setCameraMode(id === 'camera-01' ? 'CAMERA_01' : id === 'camera-02' ? 'CAMERA_02' : 'EXIT_CAMERA') }}>
    <mesh><boxGeometry args={[0.34, 0.25, 0.48]} /><meshStandardMaterial color="#3b3b44" emissive="#6f1525" emissiveIntensity={0.4} /></mesh>
    <mesh position={[0, -0.22, 0]}><cylinderGeometry args={[0.04, 0.04, 0.4, 8]} /><meshStandardMaterial color="#5a7e89" /></mesh>
    <mesh position={[0, 0, 0.26]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.09, 12]} /><meshBasicMaterial color="#ff3048" /></mesh>
    <Html position={[0, 0.35, 0]} center distanceFactor={11}><span className="scene-tag scene-tag-camera">{name.split('·')[0].trim()}</span></Html>
  </group>
}

function SceneContent() {
  const selected = useSceneStore((state) => state.selectedObject)
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  const showLabels = useSceneStore((state) => state.showLabels)
  const lowPerformance = useSettingsStore((state) => state.lowPerformance)
  const elapsed = useSimulationStore((state) => state.elapsedMs)
  const scenario = useSimulationStore((state) => state.scenario)
  const exitState = useSimulationStore((state) => state.session.exitState)
  const motion = deriveCustomerMotion(scenario, elapsed, exitState)
  return <>
    <color attach="background" args={['#0d0d11']} />
    <ambientLight intensity={1.45} color="#f2e9eb" />
    <directionalLight position={[-4, 8, 5]} intensity={2.5} color="#fff0f1" castShadow={!lowPerformance} />
    <pointLight position={[5, 3, 2]} intensity={22} distance={10} color="#ff3048" />
    <Floor />
    {shelves.map((shelf) => <ShelfModel key={shelf.id} shelfId={shelf.id} name={shelf.name} position={shelf.position} rotation={shelf.rotation} />)}
    {products.map((product) => <ProductModel key={product.id} productId={product.id} position={product.position} rotationY={product.rotationY} dimensions={product.dimensions} color={product.color} carried={motion.carriedProductId === product.id} />)}
    {cameras.map((camera) => <CameraModel key={camera.id} id={camera.id} name={camera.name} position={camera.position} />)}
    <ExitGate />
    <mesh position={[2.8, 0.08, 1.45]} onClick={(event) => { event.stopPropagation(); setSelectedObject('bag-zone') }}>
      <boxGeometry args={[2.3, 0.05, 1.25]} /><meshStandardMaterial color="#653f2d" transparent opacity={0.7} emissive="#2f1810" emissiveIntensity={0.3} />
    </mesh>
    {showLabels && <Text position={[2.8, 0.16, 1.45]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.19} color="#efb76c" anchorX="center">BAG ZONE · SIMULATED</Text>}
    <mesh position={[4.65, 0.08, 3.25]} onClick={(event) => { event.stopPropagation(); setSelectedObject('review-zone') }}>
      <boxGeometry args={[2.2, 0.05, 1.25]} /><meshStandardMaterial color="#3d315e" transparent opacity={0.62} emissive="#211638" emissiveIntensity={0.35} />
    </mesh>
    {showLabels && <Text position={[4.65, 0.16, 3.25]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.19} color="#bd9df0" anchorX="center">REVIEW ZONE · SIMULATED</Text>}
    <CustomerModel />
    {selected === 'bag-zone' && <Html position={[2.8, 1.2, 1.45]} center><div className="scene-popover"><strong>Bag zone</strong><span>Physical observability boundary</span><em>Click event details for evidence</em></div></Html>}
    {selected === 'review-zone' && <Html position={[4.65, 1.2, 3.25]} center><div className="scene-popover"><strong>Review zone</strong><span>Neutral human-review fallback</span><em>No intent is inferred.</em></div></Html>}
    <SceneCameraController />
    <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={5} maxDistance={19} target={[0, 0.8, 0]} />
  </>
}

export function StoreScene() {
  const lowPerformance = useSettingsStore((state) => state.lowPerformance)
  return <div className="scene-canvas-wrap" aria-label="Interactive simulated 3D store">
    <Canvas shadows={!lowPerformance} camera={{ position: [11, 9, 12], fov: 42 }} dpr={lowPerformance ? [1, 1] : [1, 1.5]} fallback={<div className="webgl-fallback">WebGL unavailable · use the 2D evidence panels to continue.</div>}>
      <SceneContent />
    </Canvas>
  </div>
}

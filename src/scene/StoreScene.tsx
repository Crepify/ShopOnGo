import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, Text } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { cameras } from '../data/cameras'
import { productById, products } from '../data/products'
import { shelves } from '../data/shelves'
import { useSceneStore } from '../stores/sceneStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useSimulationStore } from '../stores/simulationStore'

const floorColor = '#0b1d2b'

function SceneCameraController() {
  const { camera } = useThree()
  const mode = useSceneStore((state) => state.cameraMode)
  const target = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, delta) => {
    if (mode === 'OPERATOR') return
    const position = mode === 'CUSTOMER_FOLLOW' ? new THREE.Vector3(-2, 3.4, 4.8) : mode === 'CAMERA_01' ? new THREE.Vector3(-7, 5.6, 3.2) : mode === 'CAMERA_02' ? new THREE.Vector3(0, 5.8, -4.6) : new THREE.Vector3(7.2, 4.5, 2.8)
    const look = mode === 'CUSTOMER_FOLLOW' ? new THREE.Vector3(0, 0, 0) : mode === 'CAMERA_01' ? new THREE.Vector3(-3, 0, 0) : mode === 'CAMERA_02' ? new THREE.Vector3(0, 0, -1.8) : new THREE.Vector3(6.3, 0, 0)
    camera.position.lerp(position, Math.min(1, delta * 2.5)); target.lerp(look, Math.min(1, delta * 2.5)); camera.lookAt(target)
  })
  return null
}

function Floor() {
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.05, 0]}><planeGeometry args={[18, 12]} /><meshStandardMaterial color={floorColor} roughness={0.86} /></mesh>
    <gridHelper args={[18, 18, '#17384d', '#102a3b']} position={[0, 0.01, 0]} />
    <mesh position={[0, 2.7, -5.7]}><boxGeometry args={[18, 5.4, 0.18]} /><meshStandardMaterial color="#0c1a29" /></mesh>
    <mesh position={[-8.8, 2.7, 0]}><boxGeometry args={[0.18, 5.4, 12]} /><meshStandardMaterial color="#0c1a29" /></mesh>
    <mesh position={[8.8, 2.7, 0]}><boxGeometry args={[0.18, 5.4, 12]} /><meshStandardMaterial color="#0c1a29" /></mesh>
  </>
}

function ShelfModel({ shelfId, name, position, rotation }: { shelfId: string; name: string; position: [number, number, number]; rotation: number }) {
  const selected = useSceneStore((state) => state.selectedObject === shelfId)
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  const shelf = shelves.find((item) => item.id === shelfId)!
  return <group position={position} rotation={[0, rotation, 0]} onClick={(event) => { event.stopPropagation(); setSelectedObject(shelfId) }}>
    <mesh castShadow position={[0, 0.15, 0]}><boxGeometry args={[3.1, 0.22, 0.75]} /><meshStandardMaterial color={selected ? '#1d6f84' : '#19394a'} emissive={selected ? '#0d5266' : '#061a26'} emissiveIntensity={0.6} /></mesh>
    <mesh castShadow position={[0, 1.1, 0]}><boxGeometry args={[3.1, 0.08, 0.72]} /><meshStandardMaterial color="#285064" /></mesh>
    <mesh castShadow position={[0, 2.08, 0]}><boxGeometry args={[3.1, 0.08, 0.72]} /><meshStandardMaterial color="#285064" /></mesh>
    {[-1.45, 1.45].map((x) => <mesh key={x} castShadow position={[x, 1.15, 0]}><boxGeometry args={[0.1, 2.3, 0.72]} /><meshStandardMaterial color="#2c5161" /></mesh>)}
    <Text position={[0, 2.48, 0]} fontSize={0.16} color={selected ? '#6cf7ff' : '#9bb9c6'} anchorX="center" anchorY="middle">{name.replace('Aisle ', '')}</Text>
    <Html position={[0, -0.02, 0.42]} center distanceFactor={11} style={{ pointerEvents: 'none' }}><span className="scene-tag">{shelfId.toUpperCase()}</span></Html>
  </group>
}

function ProductModel({ productId, position, dimensions, color, held = false }: { productId: string; position: [number, number, number]; dimensions: [number, number, number]; color: string; held?: boolean }) {
  const selected = useSceneStore((state) => state.selectedObject === productId)
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  const isCylinder = productId === 'milk' || productId === 'juice'
  return <group visible={!held} position={position} onClick={(event) => { event.stopPropagation(); setSelectedObject(productId) }}>
    <mesh castShadow><boxGeometry args={selected || isCylinder ? [dimensions[0] * 1.1, dimensions[1] * 1.1, dimensions[2] * 1.1] : dimensions} /><meshStandardMaterial color={selected ? '#82f5fb' : color} emissive={selected ? '#0ca4b0' : color} emissiveIntensity={selected ? 0.65 : 0.12} roughness={0.62} /></mesh>
    <mesh position={[0, 0, dimensions[2] / 2 + 0.009]}><planeGeometry args={[Math.min(dimensions[0] * 0.82, 0.5), Math.min(dimensions[1] * 0.35, 0.28)]} /><meshBasicMaterial color="#eaf6f7" transparent opacity={0.72} /></mesh>
    {selected && <Html position={[0, 0.66, 0]} center distanceFactor={9}><span className="scene-product-label">{productById[productId].name}</span></Html>}
  </group>
}

function CustomerModel() {
  const group = useRef<THREE.Group>(null)
  const elapsed = useSimulationStore((state) => state.elapsedMs)
  const status = useSimulationStore((state) => state.status)
  const scenario = useSimulationStore((state) => state.scenario)
  const selected = useSceneStore((state) => state.selectedObject === 'person_01')
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  const focusProductId = scenario.steps.find((step) => step.eventType === 'CAMERA_PICK_DETECTED')?.productId ?? 'coffee'
  const focusProduct = productById[focusProductId]
  const pickStep = scenario.steps.find((step) => step.eventType === 'CAMERA_PICK_DETECTED')
  const scanStep = scenario.steps.find((step) => step.eventType === 'ITEM_SCANNED')
  const bagStep = scenario.steps.find((step) => step.eventType === 'ITEM_MOVED_TO_BAG')
  const returnStep = scenario.steps.find((step) => step.eventType === 'CAMERA_RETURN_DETECTED')
  const pickStart = (pickStep?.delayMs ?? 3100) - 700
  const reach = Math.max(0, Math.min(1, (elapsed - pickStart) / 1100))
  const isReaching = reach > 0 && reach < 1
  const isHolding = Boolean(pickStep && elapsed >= pickStep.delayMs + 350 && (!returnStep || elapsed < returnStep.delayMs) && (!bagStep || elapsed < bagStep.delayMs))
  const isScanning = Boolean(scanStep && elapsed >= scanStep.delayMs - 450 && elapsed < scanStep.delayMs + 850)
  const waypoints = useMemo(() => [[-7.2, 0.18, 3.3], [-4.7, 0.18, 1.25], [focusProduct?.position[0] ?? -4.8, 0.18, -0.9], [0.4, 0.18, 1.15], [4.2, 0.18, 1.4], [7, 0.18, 1.35]] as [number, number, number][], [focusProduct])
  const position = useMemo(() => {
    const progress = Math.min(0.999, elapsed / 9000)
    const scaled = progress * (waypoints.length - 1)
    const index = Math.min(waypoints.length - 2, Math.floor(scaled))
    const local = scaled - index
    const eased = local * local * (3 - 2 * local)
    const a = waypoints[index] ?? waypoints[0]; const b = waypoints[index + 1] ?? a
    return [a[0] + (b[0] - a[0]) * eased, a[1], a[2] + (b[2] - a[2]) * eased] as [number, number, number]
  }, [elapsed, waypoints])
  useFrame((_, delta) => { if (group.current) { group.current.position.y = position[1] + (status === 'RUNNING' ? Math.sin(elapsed / 150) * 0.025 : 0); group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, position[0] > group.current.position.x ? 0 : Math.PI, Math.min(1, delta * 4)) } })
  const leftArmPosition: [number, number, number] = [-0.18, 0.72 + reach * 0.2, -reach * 0.24]
  const rightArmPosition: [number, number, number] = [0.18, 0.72 + reach * 0.2, -reach * 0.24]
  return <group ref={group} position={position} onClick={(event) => { event.stopPropagation(); setSelectedObject('person_01') }}>
    <mesh castShadow position={[0, 0.75, 0]}><capsuleGeometry args={[0.27, 0.58, 4, 8]} /><meshStandardMaterial color={selected ? '#70f2f1' : '#5477aa'} emissive={selected ? '#0c737d' : '#142d58'} emissiveIntensity={selected ? 0.7 : 0.3} /></mesh>
    <mesh castShadow position={[0, 1.55, 0]} rotation={[0, isReaching ? -0.18 : 0, 0]}><sphereGeometry args={[0.3, 12, 8]} /><meshStandardMaterial color="#e4b59b" /></mesh>
    <mesh castShadow position={[0, 0.25, -0.13]} rotation={[-0.25, 0, 0]}><boxGeometry args={[0.5, 0.35, 0.18]} /><meshStandardMaterial color="#d0a65c" /></mesh>
    <mesh castShadow position={leftArmPosition} rotation={[reach * 0.85, 0, 0.2 - reach * 0.62]}><capsuleGeometry args={[0.07, 0.45, 4, 6]} /><meshStandardMaterial color="#e4b59b" /></mesh>
    <mesh castShadow position={rightArmPosition} rotation={[reach * 0.85, 0, -0.2 + reach * 0.62]}><capsuleGeometry args={[0.07, 0.45, 4, 6]} /><meshStandardMaterial color="#e4b59b" /></mesh>
    {isHolding && <mesh castShadow position={[0.31, 0.95, -0.3]} rotation={[0, 0.25, 0]}><boxGeometry args={[0.22, 0.32, 0.12]} /><meshStandardMaterial color={focusProduct.color} emissive={focusProduct.color} emissiveIntensity={0.45} /></mesh>}
    {isScanning && <mesh position={[0.28, 0.9, -0.32]} rotation={[0.25, 0.1, 0]}><boxGeometry args={[0.15, 0.25, 0.025]} /><meshStandardMaterial color="#d9fbff" emissive="#2ed5e1" emissiveIntensity={1.4} /></mesh>}
    {isReaching && <Html position={[0, 2.12, 0]} center distanceFactor={9}><span className="scene-action-label">{reach < .5 ? 'REACHING' : 'PICKUP'}</span></Html>}
    <Html position={[0, 2.05, 0]} center distanceFactor={9}><span className="scene-track-label">TRACK_ID · person_01</span></Html>
  </group>
}

function ExitGate() {
  const selected = useSceneStore((state) => state.selectedObject === 'exit-01')
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  const exitState = useSimulationStore((state) => state.session.exitState)
  const color = exitState === 'APPROVED' ? '#4ff0a6' : ['PAYMENT_HELD', 'EXCEPTION_REQUIRED', 'HUMAN_REVIEW'].includes(exitState) ? '#f3ad54' : '#36c9dc'
  return <group position={[6.8, 0, 1.2]} onClick={(event) => { event.stopPropagation(); setSelectedObject('exit-01') }}>
    <mesh castShadow position={[-0.9, 1.25, 0]}><boxGeometry args={[0.18, 2.5, 0.42]} /><meshStandardMaterial color="#2e5364" /></mesh>
    <mesh castShadow position={[0.9, 1.25, 0]}><boxGeometry args={[0.18, 2.5, 0.42]} /><meshStandardMaterial color="#2e5364" /></mesh>
    <mesh position={[0, 2.42, 0]}><boxGeometry args={[1.98, 0.18, 0.42]} /><meshStandardMaterial color="#2e5364" /></mesh>
    <mesh position={[0, 2.36, 0.24]}><boxGeometry args={[1.55, 0.05, 0.03]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} /></mesh>
    <Text position={[0, 2.9, 0]} fontSize={0.22} color={selected ? '#ffffff' : color} anchorX="center">EXIT GATE</Text>
    <Html position={[0, 1.7, 0.32]} center distanceFactor={8}><span className="scene-tag scene-tag-exit">{exitState.replace('_', ' ')}</span></Html>
  </group>
}

function CameraModel({ id, name, position }: { id: string; name: string; position: [number, number, number] }) {
  const setCameraMode = useSceneStore((state) => state.setCameraMode)
  return <group position={position} onClick={(event) => { event.stopPropagation(); setCameraMode(id === 'camera-01' ? 'CAMERA_01' : id === 'camera-02' ? 'CAMERA_02' : 'EXIT_CAMERA') }}>
    <mesh castShadow><boxGeometry args={[0.34, 0.25, 0.48]} /><meshStandardMaterial color="#1d5267" emissive="#0c5c6d" emissiveIntensity={0.4} /></mesh>
    <mesh position={[0, -0.22, 0]}><cylinderGeometry args={[0.04, 0.04, 0.4, 8]} /><meshStandardMaterial color="#5a7e89" /></mesh>
    <mesh position={[0, 0, 0.26]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.09, 12]} /><meshBasicMaterial color="#54e4ed" /></mesh>
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
  const pickupStep = scenario.steps.find((step) => step.eventType === 'CAMERA_PICK_DETECTED')
  const returnStep = scenario.steps.find((step) => step.eventType === 'CAMERA_RETURN_DETECTED')
  const focusProductId = pickupStep?.productId
  const productRemoved = Boolean(focusProductId && pickupStep && elapsed >= pickupStep.delayMs + 400 && (!returnStep || elapsed < returnStep.delayMs))
  return <>
    <color attach="background" args={['#071522']} />
    <ambientLight intensity={1.3} color="#b4dfe4" />
    <directionalLight position={[-4, 8, 5]} intensity={2.2} color="#98e5ed" castShadow={!lowPerformance} />
    <pointLight position={[5, 3, 2]} intensity={18} distance={10} color="#229eb6" />
    <Floor />
    {shelves.map((shelf) => <ShelfModel key={shelf.id} shelfId={shelf.id} name={shelf.name} position={shelf.position} rotation={shelf.rotation} />)}
    {products.map((product) => <ProductModel key={product.id} productId={product.id} position={product.position} dimensions={product.dimensions} color={product.color} held={productRemoved && product.id === focusProductId} />)}
    {cameras.map((camera) => <CameraModel key={camera.id} id={camera.id} name={camera.name} position={camera.position} />)}
    <ExitGate />
    <mesh position={[2.8, 0.08, 1.45]} onClick={(event) => { event.stopPropagation(); setSelectedObject('bag-zone') }}>
      <boxGeometry args={[2.3, 0.05, 1.25]} /><meshStandardMaterial color="#653f2d" transparent opacity={0.7} emissive="#2f1810" emissiveIntensity={0.3} />
    </mesh>
    {showLabels && <Text position={[2.8, 0.16, 1.45]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.19} color="#efb76c" anchorX="center">BAG ZONE · SIMULATED</Text>}
    <CustomerModel />
    {selected === 'bag-zone' && <Html position={[2.8, 1.2, 1.45]} center><div className="scene-popover"><strong>Bag zone</strong><span>Physical observability boundary</span><em>Click event details for evidence</em></div></Html>}
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

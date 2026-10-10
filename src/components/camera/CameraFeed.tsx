import { Maximize2, Pause, Play, Target, Video, VideoOff } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { productById } from '../../data/products'
import { shelves } from '../../data/shelves'
import { deriveCustomerMotion } from '../../scene/customerMotion'
import { useSceneStore } from '../../stores/sceneStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useSimulationStore } from '../../stores/simulationStore'

type FeedCamera = 'CAMERA_01' | 'CAMERA_02' | 'EXIT_CAMERA'

const cameraCopy: Record<FeedCamera, { name: string; subtitle: string; viewBox: string }> = {
  CAMERA_01: { name: 'Camera 01 · Entry', subtitle: 'Entrance tracking', viewBox: '-9 -5.7 8.5 6.2' },
  CAMERA_02: { name: 'Camera 02 · Aisle', subtitle: 'Shelf interaction', viewBox: '-8 -4.7 13 7.5' },
  EXIT_CAMERA: { name: 'Camera 03 · Exit', subtitle: 'Checkout boundary', viewBox: '3.2 -1.4 5.8 6' },
}

export function CameraFeed() {
  const [playing, setPlaying] = useState(true)
  const [frameElapsed, setFrameElapsed] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const cameraMode = useSceneStore((state) => state.cameraMode)
  const setCameraMode = useSceneStore((state) => state.setCameraMode)
  const { overlay, boundingBoxes, confidence } = useSettingsStore((state) => state)
  const setSettings = useSettingsStore((state) => state.set)
  const scenario = useSimulationStore((state) => state.scenario)
  const elapsed = useSimulationStore((state) => state.elapsedMs)
  const session = useSimulationStore((state) => state.session)
  const events = useSimulationStore((state) => state.events)
  const viewportRef = useRef<HTMLDivElement>(null)
  const feedCamera: FeedCamera = cameraMode === 'CAMERA_01' || cameraMode === 'EXIT_CAMERA' ? cameraMode : 'CAMERA_02'
  const camera = cameraCopy[feedCamera]

  useEffect(() => { if (playing) setFrameElapsed(elapsed) }, [elapsed, playing])

  const motion = deriveCustomerMotion(scenario, frameElapsed, session.exitState)
  const physicalProductId = motion.focusProductId
  const physicalProduct = productById[physicalProductId]
  const latestVision = [...events].reverse().find((event) => event.source === 'VISION_SIMULATOR')
  const uncertain = latestVision?.type === 'CAMERA_UNCERTAIN' || latestVision?.type === 'TRACK_ASSOCIATION_UNCERTAIN' || (latestVision?.confidence ?? 1) < 0.65
  const action = latestVision?.type === 'ITEM_MOVED_TO_BAG' ? 'ITEM UNOBSERVABLE' : latestVision?.type === 'CAMERA_PICK_DETECTED' ? 'PICK' : motion.phase === 'SCANNING' ? 'SCAN' : uncertain ? 'UNCERTAIN' : 'TRACKING'
  const cameraConfidence = latestVision?.confidence ?? (motion.phase === 'ENTERING' ? 0.98 : 0.94)
  const shelf = shelves.find((item) => item.id === physicalProduct.shelfId) ?? shelves[0]
  const boxColor = action === 'UNCERTAIN' ? '#ffae35' : action === 'ITEM UNOBSERVABLE' ? '#ff3048' : action === 'PICK' || action === 'SCAN' ? '#ff3048' : '#35d7bd'
  const toggleFullscreen = async () => {
    if (!viewportRef.current) return
    if (document.fullscreenElement) { await document.exitFullscreen(); setFullscreen(false); return }
    await viewportRef.current.requestFullscreen?.(); setFullscreen(true)
  }
  const setFeedCamera = (value: FeedCamera) => setCameraMode(value)

  return <div className={`camera-panel camera-panel-live ${fullscreen ? 'fullscreen-camera-panel' : ''}`}><div className="panel-heading"><div><div className="panel-kicker"><Video size={13} /> Computer vision feed</div><h3>{camera.name}</h3><span className="camera-subtitle">{camera.subtitle} · simulated frame</span></div><span className="live-tag"><i /> LIVE SIMULATED CV</span></div><div className="camera-viewport camera-viewport-live" ref={viewportRef}><svg viewBox={camera.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${camera.name} simulated camera view`}><rect x="-9" y="-5.7" width="18" height="10.2" rx=".15" className="cv-floor" /><path d="M -8 1.2 L 6.8 1.2" className="cv-route" />{shelves.map((item) => <g key={item.id} className={item.id === shelf.id ? 'cv-shelf active' : 'cv-shelf'} transform={`translate(${item.position[0]} ${item.position[2]}) rotate(${item.rotation * 57.3})`}><rect x="-1.55" y="-.38" width="3.1" height=".76" rx=".08" /><text x="0" y="-.58">{item.id.replace('shelf-', 'A')}</text></g>)}<rect x="1.65" y=".82" width="2.3" height="1.25" rx=".08" className="cv-zone bag" /><rect x="4.65" y="2.62" width="2.2" height="1.25" rx=".08" className="cv-zone review" /><rect x="6.0" y=".5" width="1.6" height="1.4" rx=".08" className="cv-exit" /><text x="6.8" y=".34" className="cv-exit-label">EXIT</text><circle cx={physicalProduct.position[0]} cy={physicalProduct.position[2]} r=".17" fill={boxColor} className="cv-product-dot" /><g transform={`translate(${motion.position[0]} ${motion.position[2]})`} className="cv-customer"><circle cy="-.42" r=".23" /><rect x="-.3" y="-.2" width=".6" height=".85" rx=".18" /><path d="M -.17 .65 L -.22 1.05 M .17 .65 L .22 1.05" /></g>{boundingBoxes && <><rect x={motion.position[0] - .48} y={motion.position[2] - .85} width=".96" height="1.85" rx=".1" className="cv-box person-box" stroke="#ff3048" /><text x={motion.position[0] - .48} y={motion.position[2] - .93} className="cv-label red-label">person_01</text><rect x={physicalProduct.position[0] - .35} y={physicalProduct.position[2] - .35} width=".7" height=".7" rx=".08" className="cv-box product-box" style={{ stroke: boxColor }} /><text x={physicalProduct.position[0] - .35} y={physicalProduct.position[2] - .45} className="cv-label" style={{ fill: boxColor }}>{action}</text></>}{overlay && <g className="cv-overlay"><rect x={camera.viewBox.split(' ')[0] as unknown as number} y={camera.viewBox.split(' ')[1] as unknown as number} width="0" height="0" /><text x={camera.viewBox.startsWith('3.2') ? '3.55' : '-8.6'} y={camera.viewBox.startsWith('3.2') ? '-.85' : '-5.05'}>ZONE: {latestVision?.shelfId ?? physicalProduct.shelfId}</text><text x={camera.viewBox.startsWith('3.2') ? '3.55' : '-8.6'} y={camera.viewBox.startsWith('3.2') ? '-.48' : '-4.68'}>ACTION: {action}</text></g>}</svg><div className="camera-frame-badge"><span><i /> SIMULATED FRAME</span><b>{Math.round(cameraConfidence * 100)}%</b></div><div className={`camera-scanline ${playing ? 'moving' : ''}`} /></div><div className="camera-controls"><select value={feedCamera} onChange={(event) => setFeedCamera(event.target.value as FeedCamera)} aria-label="Select camera feed"><option value="CAMERA_01">Camera 01 · Entry</option><option value="CAMERA_02">Camera 02 · Aisle</option><option value="EXIT_CAMERA">Camera 03 · Exit</option></select><button className="icon-button" aria-label={playing ? 'Pause camera feed' : 'Play camera feed'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={14} /> : <Play size={14} />}</button><button className="icon-button" aria-label="Toggle camera overlays" onClick={() => setSettings({ overlay: !overlay })}><Target size={14} /></button><button className="icon-button" aria-label={fullscreen ? 'Exit fullscreen camera feed' : 'Open fullscreen camera feed'} onClick={toggleFullscreen}><Maximize2 size={14} /></button></div><div className="camera-toggles"><button className={overlay ? 'on' : ''} onClick={() => setSettings({ overlay: !overlay })}>{overlay ? <Video size={12} /> : <VideoOff size={12} />} overlay</button><button className={boundingBoxes ? 'on' : ''} onClick={() => setSettings({ boundingBoxes: !boundingBoxes })}><span className="box-icon" /> boxes</button><button className={confidence ? 'on' : ''} onClick={() => setSettings({ confidence: !confidence })}>confidence</button></div>{confidence && <div className="confidence-strip"><span>PERSON <b>{Math.round(cameraConfidence * 100)}%</b></span><span>INTERACTION <b>{Math.round((latestVision?.confidence ?? .88) * 100)}%</b></span><span>PRODUCT <b>{Math.round((latestVision?.confidence ?? .82) * 100)}%</b></span></div>}<div className="camera-readable-state"><strong>{action === 'TRACKING' ? 'Customer track active' : action === 'PICK' ? 'Physical pickup detected' : action === 'SCAN' ? 'Scan interaction visible' : action === 'ITEM UNOBSERVABLE' ? 'Item visibility reduced' : 'Camera confidence reduced'}</strong><span>T+{(frameElapsed / 1000).toFixed(1)}s · {motion.phase.replaceAll('_', ' ').toLowerCase()}</span></div></div>
}

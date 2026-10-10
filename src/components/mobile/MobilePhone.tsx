import { AlertTriangle, ArrowRight, Bell, Check, ChevronLeft, Home, ScanLine, ShoppingBag, Smartphone, Wifi, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { productById, products } from '../../data/products'
import { notificationsForEvents, type AppNotification } from '../../simulation/eventPresentation'
import { declaredCart, guidedScanner, isScan, SCAN_DURATION_MS } from '../../simulation/scanner'
import { useSceneStore } from '../../stores/sceneStore'
import { useSimulationStore } from '../../stores/simulationStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { StatusPill } from '../common/StatusPill'
import { ProductArtwork, ProductScan } from './ProductScan'

type PhoneView = 'home' | 'cart' | 'scan' | 'notifications'

export function MobilePhone() {
  const revision = useSimulationStore((s) => s.runRevision)
  return <ShopperSession key={revision} />
}

function ShopperSession() {
  const sim = useSimulationStore()
  const { scenario, session, events, elapsedMs, result, status, pendingScan, interactionMode, awaitingScanStepId, beginScan, cancelScan, scanError } = sim
  const selectedObject = useSceneStore((s) => s.selectedObject)
  const setSelectedObject = useSceneStore((s) => s.setSelectedObject)
  const reducedMotion = useSettingsStore((s) => s.reducedMotion)
  const [view, setView] = useState<PhoneView>('home')
  const [productId, setProductId] = useState(scenario.steps.find((step) => isScan({ type: step.eventType }))?.productId ?? scenario.steps.find((step) => step.productId)?.productId ?? 'coffee')
  const [dismissedScan, setDismissedScan] = useState<string>()
  const [readCount, setReadCount] = useState(0)
  const notifications = useMemo(() => notificationsForEvents(events), [events])
  const cart = useMemo(() => declaredCart(events), [events])
  const latestScan = [...events].reverse().find((event) => event.source === 'MOBILE' && isScan(event))
  const latestPickup = [...events].reverse().find((event) => event.type === 'CAMERA_PICK_DETECTED')
  const autoScan = interactionMode === 'GUIDED' ? guidedScanner(scenario, elapsedMs, events) : undefined
  const activeScan = pendingScan ? { productId: pendingScan.productId, progress: pendingScan.progressMs / SCAN_DURATION_MS } : autoScan
  const success = latestScan && latestScan.id !== dismissedScan && elapsedMs - (latestScan.timestamp - session.startedAt) < 1250
  const showScanner = Boolean(activeScan || success || awaitingScanStepId || view === 'scan')
  const scannedProduct = activeScan?.productId ?? (success ? latestScan?.productId : undefined)
  const product = productById[scannedProduct ?? productId] ?? products[0]
  const checkout = events.some((e) => e.type === 'PAYMENT_APPROVED' || e.type === 'PAYMENT_HELD' || e.type === 'EXCEPTION_CREATED')
  const checkoutStarted = events.some((e) => e.type === 'EXIT_ATTEMPTED')
  const approved = checkout && result?.overallStatus === 'APPROVED'
  const total = cart.reduce((sum, row) => sum + row.product.price * row.quantity, 0)
  const count = cart.reduce((sum, row) => sum + row.quantity, 0)
  const pickupNeedsScan = latestPickup?.productId && !cart.some((row) => row.product.id === latestPickup.productId)
  const frozen = status !== 'RUNNING' || reducedMotion

  // Product selection is shared with the 3D scene. Never change a barcode mid-scan.
  useEffect(() => {
    if (selectedObject && productById[selectedObject] && !pendingScan) { setProductId(selectedObject); setView('scan'); setDismissedScan(latestScan?.id) }
  }, [selectedObject])
  useEffect(() => {
    const step = scenario.steps.find((candidate) => candidate.id === awaitingScanStepId)
    if (step?.productId) { setProductId(step.productId); setView('scan'); setDismissedScan(latestScan?.id) }
  }, [awaitingScanStepId])

  const navigate = (next: PhoneView) => {
    if (pendingScan) return
    setDismissedScan(latestScan?.id)
    setView(next)
    if (next === 'notifications') setReadCount(notifications.length)
  }
  const selectProduct = (id: string) => { setProductId(id); setSelectedObject(id); setDismissedScan(latestScan?.id) }

  return <section className={`mobile-phone-panel shopper-app-panel interactive-phone ${frozen ? 'phone-motion-paused' : ''}`} data-tutorial="PHONE" aria-label="Interactive shopper phone">
    <div className="mobile-phone-header"><div><div className="panel-kicker"><Smartphone size={13} /> Shopper's phone</div><h3>Scan. Shop. Go.</h3></div><span className="simulated-label">SIMULATED</span></div>
    <div className="phone-frame phone-frame-bright">
      <div className="phone-topbar bright-topbar"><span>09:41</span><div className="phone-notch" /><span><Wifi size={11} /> ▰</span></div>
      <div className="phone-app-screen">
        <header className="app-header bright-app-header"><button className="phone-back" onClick={() => navigate('home')} disabled={Boolean(pendingScan)} aria-label="Shopping home"><ChevronLeft size={15} /></button><div><span>SHOPONGO MARKET</span><strong>Your everyday, easier.</strong></div><button className="phone-notification-button" onClick={() => navigate('notifications')} disabled={Boolean(pendingScan)} aria-label="Open store notifications"><Bell size={16} />{notifications.length > readCount && <b>{Math.min(9, notifications.length - readCount)}</b>}</button></header>
        <div className="phone-live-content">
          {showScanner ? <div className="phone-scanner-page">
            <div className="phone-section-heading"><span>{pendingScan ? 'YOU ARE SCANNING' : autoScan ? 'SHOPPER IS SCANNING' : awaitingScanStepId ? 'YOUR TURN TO SCAN' : success ? 'ADDED TO YOUR CART' : 'TRY THE SCANNER'}</span><strong>{success ? 'Got it!' : 'One item. One scan.'}</strong></div>
            <ProductScan product={product} progress={activeScan?.progress} state={activeScan ? 'SCANNING' : success ? 'SUCCESS' : 'READY'} frozen={frozen} />
            {!activeScan && !success && <><label className="phone-product-select">Choose an item, or click it in the store<select aria-label="Product to scan" value={productId} onChange={(e) => selectProduct(e.target.value)}>{products.map((p) => <option value={p.id} key={p.id}>{p.name} · ₹{p.price}</option>)}</select></label><button className="phone-primary bright-phone-primary" onClick={() => beginScan(productId)} disabled={checkoutStarted || ['COMPLETE', 'STOPPED'].includes(status)}><ScanLine size={16} /> Scan {product.name}</button><p className="phone-scanner-note">{awaitingScanStepId ? 'The journey is waiting for you. Scanning continues the trip.' : 'A scan adds a phone declaration. Camera and shelf evidence are checked separately.'}</p></>}
            {pendingScan && <div className="scanner-actions"><button onClick={() => status === 'RUNNING' ? sim.pause() : sim.start()}>{status === 'RUNNING' ? 'Pause scan' : 'Resume scan'}</button><button onClick={cancelScan}>Cancel</button></div>}
            {autoScan && <p className="phone-scanner-note">Guided demo · the shopper is declaring this barcode.</p>}
            {success && <button className="phone-primary bright-phone-primary" onClick={() => navigate('cart')}>View cart · ₹{total}<ArrowRight size={15} /></button>}
            {scanError && <p role="alert" className="phone-inline-error">{scanError}</p>}
            {checkoutStarted && !activeScan && !success && <p className="phone-scanner-note">Checkout has started. Restart the journey to try another item.</p>}
          </div> : view === 'home' ? <>
            <div className="shopper-app-greeting"><div><span>WELCOME TO YOUR LOCAL STORE</span><strong>Less waiting.<br />More living.</strong></div><div className="shopper-avatar"><ShoppingBag size={23} /></div></div>
            <button className="shopper-scan-cta" onClick={() => navigate('scan')}><ScanLine size={32} /><div><strong>Scan as you shop</strong><span>Pick an item. Point. Add to cart.</span></div><ArrowRight size={18} /></button>
            {notifications.at(-1) && <PhoneNotification notification={notifications.at(-1)!} />}
            {pickupNeedsScan && <button className="pickup-prompt" onClick={() => { selectProduct(latestPickup!.productId!); navigate('scan') }}><ProductArtwork product={productById[latestPickup!.productId!]} /><div><span>PHYSICAL ITEM OBSERVED</span><strong>{productById[latestPickup!.productId!]?.name}</strong><small>Tap to scan this item →</small></div></button>}
            <div className="phone-reassurance"><Check size={17} /><div><strong>{checkout ? approved ? 'Transaction verified' : 'A quick review is needed' : 'Keep shopping'}</strong><p>{checkout ? approved ? 'Your demo receipt is in the cart.' : 'Payment held. Visit the review point for help.' : 'Your phone declarations are compared with separate store observations.'}</p></div></div>
            <button className="phone-cart-shortcut" onClick={() => navigate('cart')}><ShoppingBag size={18} /><span>{count} {count === 1 ? 'item' : 'items'} in your cart</span><strong>₹{total}</strong></button>
          </> : view === 'cart' ? <div className="phone-cart-page">
            <div className="phone-section-heading"><span>{approved ? 'DEMO RECEIPT' : 'DECLARED ON YOUR PHONE'}</span><strong>{approved ? 'You’re good to go.' : 'Your shopping bag'}</strong></div>
            {!cart.length && <div className="mobile-empty-cart"><ShoppingBag size={30} /><strong>Your bag is empty</strong><span>Physical observations alone do not add a charge.</span><button onClick={() => navigate('scan')}>Scan an item</button></div>}
            {cart.map(({ product: p, quantity }) => <div className="shopper-cart-item" key={p.id}><ProductArtwork product={p} /><div><strong>{p.name}</strong><span>{quantity} × ₹{p.price}</span><StatusPill status={result?.itemResults.find((i) => i.productId === p.id)?.status ?? 'UNVERIFIED'} small /></div><b>₹{quantity * p.price}</b></div>)}
            <div className="phone-total bright-phone-total"><span>{approved ? 'Demo total' : 'Declared subtotal'}</span><strong>₹{total}</strong></div>
            <p className="phone-scanner-note">{checkout ? approved ? 'Simulated authorization only. No money was charged.' : 'Payment held pending review. No money was charged.' : 'Final verification happens at the exit.'}</p>
            {!checkoutStarted && <button className="phone-primary bright-phone-primary" onClick={() => navigate('scan')}><ScanLine size={16} /> Scan another item</button>}
          </div> : <div className="bright-notification-view"><div className="phone-section-heading"><span>STORE ACTIVITY</span><strong>What’s happening</strong></div>{notifications.length ? notifications.slice().reverse().map((n) => <PhoneNotification key={n.id} notification={n} />) : <div className="mobile-empty-cart"><Bell size={24} /><span>Updates appear when the journey starts.</span></div>}</div>}
        </div>
        <nav className="shopper-bottom-nav" aria-label="Shopper app navigation">{([{ id: 'home', label: 'Home', icon: Home }, { id: 'scan', label: 'Scan', icon: ScanLine }, { id: 'cart', label: 'My bag', icon: ShoppingBag }] as const).map(({ id, label, icon: Icon }) => <button key={id} disabled={Boolean(pendingScan)} aria-pressed={showScanner ? id === 'scan' : view === id} onClick={() => navigate(id)}><Icon size={18} /><span>{label}</span></button>)}</nav>
      </div><div className="phone-home-indicator bright-home-indicator" />
    </div><div className="mobile-phone-foot bright-phone-foot"><span><i className="status-dot red-dot" /> {interactionMode === 'INTERACTIVE' ? 'You control mobile scans' : 'Synced to guided playback'}</span><span>No real payment</span></div>
  </section>
}

function PhoneNotification({ notification }: { notification: AppNotification }) {
  return <div className={`phone-notification-card ${notification.tone.toLowerCase()}`}><div className="phone-notification-icon">{notification.tone === 'SUCCESS' ? <Check size={14} /> : notification.tone === 'ERROR' ? <AlertTriangle size={14} /> : <Bell size={14} />}</div><div><span>STORE UPDATE</span><strong>{notification.title}</strong><p>{notification.message}</p></div></div>
}

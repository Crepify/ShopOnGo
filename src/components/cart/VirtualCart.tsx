import { Check, CircleDashed, Eye, Minus, Plus, ScanLine, ShieldAlert, Smartphone } from 'lucide-react'
import { useSimulationStore } from '../../stores/simulationStore'
import { productById } from '../../data/products'
import { StatusPill } from '../common/StatusPill'

export function VirtualCart({ detailed = false }: { detailed?: boolean }) {
  const result = useSimulationStore((state) => state.result)
  const events = useSimulationStore((state) => state.events)
  const itemResults = result?.itemResults ?? []
  const subtotal = itemResults.reduce((sum, item) => sum + item.price * item.quantity, 0)
  return <div className={`cart-panel ${detailed ? 'detailed' : ''}`}>
    <div className="panel-heading"><div><div className="panel-kicker"><ScanLine size={13} /> Virtual cart</div><h3>Declared vs observed</h3></div><span className="simulated-label">SIMULATED</span></div>
    {itemResults.length === 0 ? <div className="cart-empty"><div className="cart-empty-ring"><ScanLine size={18} /></div><strong>Cart is empty</strong><span>Items will appear when a mobile or physical evidence event arrives.</span></div> : <div className="cart-items">{itemResults.map((item) => { const product = productById[item.productId]; return <div className="cart-item" key={item.productId}><div className="product-swatch" style={{ background: product.color }}><span>{product.name.split(' ')[0].slice(0, 2).toUpperCase()}</span></div><div className="cart-item-body"><div className="cart-item-title"><strong>{product.name}</strong><span>₹{product.price}</span></div><div className="cart-item-evidence"><span className={item.scanned ? 'good' : ''}><Smartphone size={11} /> {item.scanned ? `Scanned ×${item.scannedQuantity}` : 'Not scanned'}</span><span className={item.observed ? 'good' : ''}><Eye size={11} /> {item.observed ? `Observed ×${item.observedQuantity}` : 'No physical evidence'}</span></div><div className="cart-item-bottom"><StatusPill status={item.status} small /><span className="confidence"><i style={{ width: `${item.confidence * 100}%` }} />{Math.round(item.confidence * 100)}%</span></div>{detailed && <div className="cart-item-note">{item.reason ?? 'Evidence is still being reconciled.'}</div>}</div></div> })}</div>}
    <div className="cart-summary"><div><span>Observed lines</span><strong>{itemResults.length}</strong></div><div><span>Subtotal</span><strong>₹{subtotal.toLocaleString('en-IN')}</strong></div></div>
    {result && <div className={`cart-result ${result.overallStatus.toLowerCase()}`}><div className="cart-result-icon">{result.overallStatus === 'APPROVED' ? <Check size={16} /> : <ShieldAlert size={16} />}</div><div><strong>{result.overallStatus === 'APPROVED' ? 'Fusion reconciled' : 'Verification required'}</strong><span>{result.reasons[0] ?? 'No unresolved evidence.'}</span></div></div>}
  </div>
}

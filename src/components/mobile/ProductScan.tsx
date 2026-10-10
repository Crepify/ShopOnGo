import { Check, ScanLine } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Product } from '../../types'

export function ProductArtwork({ product }: { product: Product }) {
  // Original procedural package and decorative barcode; no camera or barcode API.
  const bottle = product.id === 'milk' || product.id === 'juice'
  return <div className={`scan-package ${bottle ? 'bottle' : ''}`} style={{ '--package-color': product.color } as CSSProperties}>
    <div className="package-cap" /><span className="package-brand">SHOPONGO</span>
    <strong>{product.name}</strong><span className="package-weight">{product.weightGrams} g</span>
    <svg viewBox="0 0 104 30" className="package-barcode" aria-label={`Simulated barcode for ${product.name}`} role="img">
      <rect width="104" height="30" fill="white" />{Array.from({ length: 32 }, (_, i) => <rect key={i} x={4 + i * 3} y="2" width={((product.sku.charCodeAt(i % product.sku.length) + i) % 2) + 1} height={i % 6 === 0 ? 26 : 22} fill="#17171b" />)}
    </svg>
  </div>
}

export function ProductScan({ product, progress = 0, state, frozen }: { product: Product; progress?: number; state: 'READY' | 'SCANNING' | 'SUCCESS'; frozen: boolean }) {
  const stage = state === 'SUCCESS' ? 'Barcode recognized' : state === 'READY' ? 'Tap scan when ready' : progress < .3 ? 'Aligning barcode…' : progress < .8 ? 'Reading product code…' : 'Adding to your cart…'
  return <div className={`visual-product-scan ${state.toLowerCase()} ${frozen ? 'scan-frozen' : ''}`} data-scan-state={state}>
    <div className="scan-viewfinder"><span className="scan-viewfinder-label"><ScanLine size={12} /> SIMULATED SCANNER</span>
      <ProductArtwork product={product} /><div className="scanner-reticle" />
      {state === 'SCANNING' && <div className="scanner-laser" style={{ top: `${23 + progress * 60}%` }} />}
      {state === 'SUCCESS' && <span className="scanner-success"><Check size={22} /></span>}
      <span className="scanner-code">{product.sku}</span>
    </div>
    <div className="scan-stage" aria-live="polite"><strong>{stage}</strong><span>{state === 'SUCCESS' ? 'Declaration saved · physical verification is separate' : `${product.name} · ₹${product.price}`}</span></div>
    {state === 'SCANNING' && <div className="scan-meter" role="progressbar" aria-label="Barcode scan progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress * 100}%` }} /></div>}
  </div>
}

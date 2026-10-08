import type { Product } from '../types'

export const products: Product[] = [
  { id: 'coffee', sku: 'SKU-COF-180', name: 'Roast coffee', category: 'Beverages', price: 180, weightGrams: 420, color: '#b8794a', shelfId: 'shelf-01', position: [-5.4, 1.53, -2.3], dimensions: [0.48, 0.78, 0.25] },
  { id: 'milk', sku: 'SKU-MLK-065', name: 'Fresh milk', category: 'Chilled', price: 65, weightGrams: 1020, color: '#e6f0ef', shelfId: 'shelf-01', position: [-4.7, 1.54, -2.3], dimensions: [0.38, 0.8, 0.38] },
  { id: 'chips', sku: 'SKU-CHP-090', name: 'Sea salt chips', category: 'Snacks', price: 90, weightGrams: 110, color: '#d59a45', shelfId: 'shelf-02', position: [-1.65, 1.51, -2.3], dimensions: [0.55, 0.74, 0.2] },
  { id: 'cereal', sku: 'SKU-CER-240', name: 'Morning cereal', category: 'Breakfast', price: 240, weightGrams: 370, color: '#5a8bb7', shelfId: 'shelf-02', position: [-0.95, 1.57, -2.3], dimensions: [0.55, 0.86, 0.2] },
  { id: 'juice', sku: 'SKU-JCE-110', name: 'Citrus juice', category: 'Beverages', price: 110, weightGrams: 980, color: '#d77640', shelfId: 'shelf-03', position: [2.1, 1.56, -2.3], dimensions: [0.4, 0.83, 0.38] },
  { id: 'soap', sku: 'SKU-SP-120', name: 'Clean hands soap', category: 'Care', price: 120, weightGrams: 290, color: '#79b8b2', shelfId: 'shelf-03', position: [2.78, 1.48, -2.3], dimensions: [0.52, 0.68, 0.22] },
  { id: 'chocolate', sku: 'SKU-CHO-075', name: 'Dark chocolate', category: 'Snacks', price: 75, weightGrams: 90, color: '#7652a4', shelfId: 'shelf-04', position: [5.35, 1.32, 0.3], rotationY: Math.PI / 2, dimensions: [0.65, 0.36, 0.16] },
  { id: 'pasta', sku: 'SKU-PAS-155', name: 'Penne pasta', category: 'Pantry', price: 155, weightGrams: 500, color: '#d5b45d', shelfId: 'shelf-04', position: [5.35, 1.35, 1.0], rotationY: Math.PI / 2, dimensions: [0.64, 0.42, 0.18] },
]

export const productById = Object.fromEntries(products.map((product) => [product.id, product])) as Record<string, Product>

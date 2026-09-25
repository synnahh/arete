//  openFoodFacts.js  shared food-search + barcode lookup
// Extracted from tabs/Health.jsx so the mobile build (barcode scanner + food
// search) uses the exact same logic instead of a second, drifting copy.

import { extractMicrosFromOFF } from './micronutrients.js';
import { platformFetch } from './platform.js';

function mapProduct(p) {
  return {
    name: p.product_name ?? 'Unknown product',
    per100: {
      calories: Math.round(p.nutriments?.['energy-kcal_100g'] ?? 0),
      protein:  Math.round((p.nutriments?.proteins_100g ?? 0) * 10) / 10,
      carbs:    Math.round((p.nutriments?.carbohydrates_100g ?? 0) * 10) / 10,
      fat:      Math.round((p.nutriments?.fat_100g ?? 0) * 10) / 10,
      micros:   extractMicrosFromOFF(p.nutriments),
    },
  };
}

export async function searchOpenFoodFacts(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?action=process&search_terms=${encodeURIComponent(query)}&json=1&fields=product_name,nutriments&page_size=8&search_simple=1`;
  const res = await platformFetch(url);
  if (!res.ok) throw new Error('Food search failed');
  const data = await res.json();
  return (data.products || []).filter(p => p.product_name).map(mapProduct);
}

export async function lookupBarcode(code) {
  const url = `https://world.openfoodfacts.org/api/v0/product/${code}.json`;
  const res = await platformFetch(url);
  const data = await res.json();
  if (data.status !== 1) throw new Error('Product not found');
  return mapProduct(data.product);
}

// Shared BarcodeDetector-based scanner. Calls onDetect(code) once, then stops
// itself — caller decides what happens next (lookup, close UI, etc).
export function startBarcodeScan(videoEl, { onDetect, onError }) {
  if (!window.BarcodeDetector) {
    onError?.(new Error('Barcode scanner not supported in this browser.'));
    return () => {};
  }
  let stopped = false;
  let stream = null;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 640, height: 480 } })
    .then(s => {
      if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s;
      if (videoEl) { videoEl.srcObject = s; videoEl.play().catch(() => {}); }
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
      const scan = async () => {
        if (stopped) return;
        try {
          const codes = await detector.detect(videoEl);
          if (codes.length) { onDetect?.(codes[0].rawValue); }
          else if (!stopped) requestAnimationFrame(scan);
        } catch { if (!stopped) requestAnimationFrame(scan); }
      };
      requestAnimationFrame(scan);
    })
    .catch(err => onError?.(err));

  return function stop() {
    stopped = true;
    stream?.getTracks().forEach(t => t.stop());
  };
}

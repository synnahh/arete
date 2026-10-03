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

// True when the device can show a camera at all. iOS Safari has no BarcodeDetector,
// so scanning there uses the bundled ZXing decoder instead (loaded on first scan).
export function canScanBarcodes() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

// Shared scanner. Calls onDetect(code) once, then stops itself — caller decides
// what happens next (lookup, close UI, etc). Uses the browser's BarcodeDetector
// where it exists (Chrome, Android) and ZXing everywhere else (iPhone Safari).
export function startBarcodeScan(videoEl, { onDetect, onError }) {
  if (!canScanBarcodes()) {
    onError?.(new Error('This browser cannot open the camera. Type the barcode instead.'));
    return () => {};
  }
  let stopped = false;
  let stream = null;
  let zxing = null;
  const finish = (code) => { if (stopped) return; stop(); onDetect?.(code); };

  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
    .then(async (s) => {
      if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s;
      if (videoEl) {
        videoEl.setAttribute('playsinline', '');
        videoEl.muted = true;
        videoEl.srcObject = s;
        videoEl.play().catch(() => {});
      }
      if (window.BarcodeDetector) {
        const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        const scan = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(videoEl);
            if (codes.length) finish(codes[0].rawValue);
            else if (!stopped) requestAnimationFrame(scan);
          } catch { if (!stopped) requestAnimationFrame(scan); }
        };
        requestAnimationFrame(scan);
        return;
      }
      const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import('@zxing/library');
      if (stopped) return;
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      zxing = new BrowserMultiFormatReader(hints, 150);
      zxing.decodeFromStream(s, videoEl, (result) => { if (result) finish(result.getText()); }).catch(err => !stopped && onError?.(err));
    })
    .catch(err => onError?.(err));

  function stop() {
    stopped = true;
    try { zxing?.reset(); } catch { /* already stopped */ }
    stream?.getTracks().forEach(t => t.stop());
  }
  return stop;
}

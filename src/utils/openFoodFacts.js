//  openFoodFacts.js  shared food-search + barcode lookup
// Extracted from tabs/Health.jsx so the mobile build (barcode scanner + food
// search) uses the exact same logic instead of a second, drifting copy.

import { extractMicrosFromOFF } from './micronutrients.js';
import { platformFetch } from './platform.js';
import { supabase } from '../supabase/supabase.js';

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

// Branded-product search. The old world.openfoodfacts.org/cgi/search.pl route fails
// from the browser (no CORS), while the country sites answer, so try Australia
// first (local brands), then the rest of the world.
const OFF_HOSTS = ['au.openfoodfacts.org', 'world.openfoodfacts.org'];

export async function searchOpenFoodFacts(query) {
  let lastError = null;
  for (const host of OFF_HOSTS) {
    try {
      const url = `https://${host}/cgi/search.pl?action=process&search_terms=${encodeURIComponent(query)}&json=1&fields=product_name,nutriments&page_size=8`;
      const res = await platformFetch(url);
      if (!res.ok) throw new Error('Food search failed');
      const data = await res.json();
      const found = (data.products || []).filter(p => p.product_name).map(mapProduct);
      if (found.length) return found;
    } catch (e) { lastError = e; }
  }
  if (lastError) throw lastError;
  return [];
}

// Server-side search (USDA generic foods + Open Food Facts, with the User-Agent and
// rate-limit handling a browser cannot provide). 404/503 means it is not deployed:
// skip it for the session and use the direct route below.
let serverSearchOff = false;
async function searchViaServer(query) {
  if (serverSearchOff) return null;
  try {
    const { data, error } = await supabase.functions.invoke('food-search', { body: { query } });
    if (error) {
      const status = error.context?.status;
      if (status === 404 || status === 503) serverSearchOff = true;
      return null;
    }
    return Array.isArray(data?.foods) ? data.foods : null;
  } catch { return null; }
}

// Everything the app can search: the server (generic + branded) first, then the
// direct Open Food Facts route when the server is unavailable or finds nothing.
export async function searchFoods(query) {
  const viaServer = await searchViaServer(query);
  if (viaServer?.length) return viaServer;
  return searchOpenFoodFacts(query);
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

// ── Camera, asked for once ─────────────────────────────────────────────────────
// iPhone asks for camera permission every time getUserMedia is called, so closing the
// scanner and opening it again used to ask again. The stream is now kept for a short
// while after you close the scanner (so scanning several items asks once), and let go
// straight away when the app goes to the background. Nothing records or sends frames.
const IDLE_MS = 30000;
const cam = { stream: null, timer: null, pending: null };

function acquireCamera() {
  clearTimeout(cam.timer);
  if (cam.stream?.active) return Promise.resolve(cam.stream);
  if (cam.pending) return cam.pending;
  cam.pending = navigator.mediaDevices
    .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
    .then((s) => { cam.stream = s; return s; })
    .finally(() => { cam.pending = null; });
  return cam.pending;
}
function releaseCameraSoon() {
  clearTimeout(cam.timer);
  cam.timer = setTimeout(releaseCameraNow, IDLE_MS);
}
export function releaseCameraNow() {
  clearTimeout(cam.timer);
  cam.stream?.getTracks().forEach(t => t.stop());
  cam.stream = null;
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseCameraNow(); });
}

/**
 * Read a barcode from a photo (an <input type="file" capture> result). The phone's own
 * camera sheet takes the picture, so there is no web camera permission at all.
 * Resolves to the code, or rejects when none is found.
 */
export async function decodeBarcodeFromFile(file) {
  const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import('@zxing/library');
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const url = URL.createObjectURL(file);
  try { return (await new BrowserMultiFormatReader(hints).decodeFromImageUrl(url)).getText(); }
  finally { URL.revokeObjectURL(url); }
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
  let timer = null;
  const finish = (code) => { if (stopped) return; stop(); onDetect?.(code); };

  acquireCamera()
    .then(async (s) => {
      if (stopped) { releaseCameraSoon(); return; }
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
      // Our own frame loop (the library's stream helper stops the camera when it is reset,
      // which would throw the permission away).
      const { MultiFormatReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource, DecodeHintType, BarcodeFormat } = await import('@zxing/library');
      if (stopped) return;
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new MultiFormatReader();
      reader.setHints(hints);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      timer = setInterval(() => {
        if (stopped || !videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return;
        const w = Math.min(videoEl.videoWidth, 960);
        const h = Math.round(videoEl.videoHeight * (w / videoEl.videoWidth));
        canvas.width = w; canvas.height = h;
        ctx.drawImage(videoEl, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h).data;
        const gray = new Uint8ClampedArray(w * h);
        for (let i = 0, j = 0; i < px.length; i += 4, j++) gray[j] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
        try { finish(reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray, w, h)))).getText()); }
        catch { /* no barcode in this frame */ }
      }, 150);
    })
    .catch(err => onError?.(err));

  function stop() {
    stopped = true;
    clearInterval(timer);
    if (videoEl) videoEl.srcObject = null;
    if (stream) releaseCameraSoon();
  }
  return stop;
}

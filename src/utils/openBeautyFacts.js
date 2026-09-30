// Open Beauty Facts: look a skincare product up by barcode. Same open-data
// project and API shape as Open Food Facts (utils/openFoodFacts.js). Coverage
// of products is patchy, so the UI always has a paste-the-ingredients path.
import { platformFetch } from './platform.js';

/** "12 months", "12M", "12-months-e" -> 12; null when there is no usable number (1-60). */
export function parsePao(value) {
  const m = /(\d{1,2})\s*-?\s*(?:months?|m)\b/i.exec(String(value || ''));
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 60 ? n : null;
}

/** A tidy product from the API's JSON, or null when the barcode is unknown. */
export function parseBeautyProduct(json) {
  const p = json?.status === 1 ? json.product : null;
  if (!p) return null;
  const name = String(p.product_name || p.generic_name || '').trim();
  const ingredients = String(p.ingredients_text_en || p.ingredients_text || '').replace(/\s+/g, ' ').trim();
  if (!name && !ingredients) return null;
  return {
    name: name || 'Unnamed product',
    brand: String(p.brands || '').split(',')[0].trim(),
    ingredients,
    paoMonths: parsePao(p.periods_after_opening),
  };
}

/** Barcodes are 6-14 digits; anything else never leaves the device. */
export const isBarcode = (v) => /^\d{6,14}$/.test(String(v || '').trim());

export async function lookupBeautyProduct(code) {
  const c = String(code || '').trim();
  if (!isBarcode(c)) throw new Error('Enter the digits under the barcode (6 to 14 numbers).');
  const res = await platformFetch(`https://world.openbeautyfacts.org/api/v2/product/${c}.json?fields=product_name,generic_name,brands,ingredients_text,ingredients_text_en,periods_after_opening`);
  if (!res.ok) throw new Error('Product lookup failed. Check your connection.');
  const product = parseBeautyProduct(await res.json());
  if (!product) throw new Error('That product is not in the database yet. Paste its ingredients instead.');
  return product;
}

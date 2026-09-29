// Supplies with the food log folded in, for code that reads the local mirror
// instead of a live collection (Today, attention, assistant context, Finance).
// Supplies itself uses applyUsage() with a live nutrition_logs collection.
import { storage, STORAGE_KEYS } from './storage.js';
import { applyUsage } from '../domain/ahead.js';

export function suppliesWithUsage(items, today) {
  const list = Array.isArray(items) ? items : [];
  try {
    const logs = storage.get(STORAGE_KEYS.MACROS, []);
    return applyUsage(list, Array.isArray(logs) ? logs : [], today);
  } catch {
    return list; // a broken mirror must never take the forecast down with it
  }
}

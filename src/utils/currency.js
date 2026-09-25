//  currency.js  single source of truth for currency display
// Previously every tab re-implemented its own symbol ternary, which drifted:
// different defaults (GBP / USD / AUD) and corrupted symbols. Import from here.

import { storage, STORAGE_KEYS } from './storage.js';

export const DEFAULT_CURRENCY = 'AUD';

export const CURRENCY_SYMBOLS = {
  AUD: 'A$',
  USD: '$',
  GBP: '£',
  EUR: '€',
};

/** Symbol for a currency code, falling back to AUD. */
export function currencySymbol(code) {
  return CURRENCY_SYMBOLS[code] ?? CURRENCY_SYMBOLS[DEFAULT_CURRENCY];
}

/** Resolve the active currency code from settings (AUD when unset). */
export function currencyCode(settings) {
  return settings?.currency || DEFAULT_CURRENCY;
}

/**
 * Read the active currency straight from saved settings — for components that
 * don't receive `settings` as a prop. (Replaces an old `valerie_currency`
 * localStorage lookup that nothing ever wrote, so it always fell back to USD.)
 */
export function readCurrency() {
  return storage.get(STORAGE_KEYS.SETTINGS, {})?.currency || DEFAULT_CURRENCY;
}

/**
 * Format an amount for display, e.g. formatMoney(12.5, 'AUD') -> "A$12.50".
 * Uses Intl when available so thousands separators are correct.
 */
export function formatMoney(amount, code = DEFAULT_CURRENCY, { decimals = 2 } = {}) {
  const n = Number(amount) || 0;
  const sym = currencySymbol(code);
  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${n < 0 ? '-' : ''}${sym}${abs}`;
}

/** Curried formatter — makeFmt('AUD')(12.5) -> "A$12.50" */
export function makeFmt(code = DEFAULT_CURRENCY, opts) {
  return (amount) => formatMoney(amount, code, opts);
}

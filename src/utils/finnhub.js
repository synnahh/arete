//  finnhub.js  Stock market data via Finnhub free API 
// Sign up at finnhub.io for a free API key (no credit card required).
// Free tier: 60 calls/minute, real-time US stock quotes.

import { platformFetch as fetch } from './platform.js';
import { rateLimitFinnhub } from './rateLimit.js';

const BASE = 'https://finnhub.io/api/v1';

/**
 * Fetch a real-time quote for a symbol.
 * Returns { c: current, d: change, dp: changePercent, h: high, l: low, o: open, pc: prevClose }
 */
export async function fetchQuote(symbol, apiKey) {
  if (!apiKey || !symbol) return null;
  rateLimitFinnhub();
  const res = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol.toUpperCase())}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Finnhub-Token': apiKey },
  });
  if (!res.ok) throw new Error(`Finnhub quote error ${res.status}`);
  const data = await res.json();
  if (!data || data.c === 0) return null; // invalid symbol returns all zeros
  return data;
}

/**
 * Search for stocks by name or ticker. Returns array of { description, symbol, type }.
 */
export async function searchSymbol(query, apiKey) {
  if (!apiKey || !query) return [];
  rateLimitFinnhub();
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Finnhub-Token': apiKey },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.result || []).filter(r => r.type === 'Common Stock').slice(0, 8);
}

/**
 * Fetch quotes for multiple symbols in parallel. Returns { SYMBOL: quoteData } map.
 */
export async function fetchWatchlist(symbols, apiKey) {
  if (!apiKey || !symbols?.length) return {};
  const results = await Promise.allSettled(
    symbols.map(s => fetchQuote(s, apiKey).then(q => [s, q]))
  );
  return Object.fromEntries(
    results
      .filter(r => r.status === 'fulfilled' && r.value[1])
      .map(r => r.value)
  );
}

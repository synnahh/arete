// Style: constants and pure helpers shared by the desktop board and the phone.
// Boards live in the `style_board` collection:
//   { title, brand, category, status, price, imageUrl, url, notes, occasion }

export const OCCASIONS = ['Smart Casual', 'Date Night', 'Work', 'Gym', 'Beach', 'Evening'];
export const CATEGORIES = ['Clothing', 'Jewellery', 'Footwear', 'Accessories', 'Outfits'];

export const STATUS_CONFIG = {
  wishlist:  { label: 'Wishlist',  color: '#5b9cf6' },
  purchased: { label: 'Purchased', color: '#4caf7d' },
  pass:      { label: 'Pass',      color: '#888'    },
};
export const STATUSES = Object.keys(STATUS_CONFIG);

const AESTHETICS = ['minimalist', 'bold', 'elegant', 'casual', 'chic', 'modern', 'classic', 'refined', 'edgy'];

export function getCurrSymbol(currency) {
  switch (currency) {
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'AUD': return 'A$';
    default:    return '$';
  }
}

export function pollinationsUrl(prompt, seed) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=400&height=500&seed=${seed}&nologo=true`;
}

/** Nine AI outfit ideas for an occasion/search. `random` is injectable for tests. */
export function buildResults(occasion, query, random = Math.random) {
  const base = [occasion, query].filter(Boolean).join(' ');
  return Array.from({ length: 9 }, (_, i) => {
    const seed = Math.floor(random() * 50000) + i * 137;
    const aesthetic = AESTHETICS[i % AESTHETICS.length];
    const subject = base || 'fashion outfit';
    const prompt = `${aesthetic} ${subject} outfit, fashion editorial, soft studio background, full body shot, professional photography`;
    return {
      id: `r_${seed}_${i}`,
      title: `${aesthetic.charAt(0).toUpperCase() + aesthetic.slice(1)} ${subject}`,
      prompt, imageUrl: pollinationsUrl(prompt, seed), occasion, query, fromGoogle: false, seed,
    };
  });
}

const money = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };

/** Counts per status and what the wishlist and purchases add up to. */
export function boardSummary(items = []) {
  const s = { counts: { wishlist: 0, purchased: 0, pass: 0 }, wishlistTotal: 0, purchasedTotal: 0 };
  for (const it of items) {
    const st = STATUS_CONFIG[it?.status] ? it.status : 'wishlist';
    s.counts[st] += 1;
    if (st === 'wishlist') s.wishlistTotal += money(it.price);
    if (st === 'purchased') s.purchasedTotal += money(it.price);
  }
  s.wishlistTotal = Math.round(s.wishlistTotal * 100) / 100;
  s.purchasedTotal = Math.round(s.purchasedTotal * 100) / 100;
  return s;
}

/** Board items for a status filter ('all' or a status), newest first. */
export function filterBoard(items = [], status = 'all') {
  return items
    .filter(it => status === 'all' || (STATUS_CONFIG[it?.status] ? it.status : 'wishlist') === status)
    .slice()
    .reverse();
}

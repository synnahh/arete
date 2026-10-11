// Food search for the app: generic foods from USDA FoodData Central (Foundation +
// SR Legacy: "chicken breast, raw") plus branded products from Open Food Facts.
// Doing this server-side matters: Open Food Facts rate-limits search and answers
// browsers with errors that carry no CORS headers (the app only sees "Failed to
// fetch"), and it asks callers to identify themselves with a User-Agent.
//
// Secrets: USDA_API_KEY (optional, free: https://fdc.nal.usda.gov/api-key-signup.html).
//          Without it only Open Food Facts results come back.
// Request:  POST { query: string }   Response: { foods: [{ name, per100, source }] }
import { corsHeaders, isOwner, json, signedInUser } from '../_shared/http.ts';

type Nutrient = { nutrientNumber?: string; value?: number };
const pick = (list: Nutrient[], ...numbers: string[]) => {
  for (const n of numbers) {
    const hit = list.find((x) => x.nutrientNumber === n && Number.isFinite(x.value));
    if (hit) return hit.value as number;
  }
  return 0;
};
const r1 = (n: number) => Math.round(n * 10) / 10;
const UA = 'Arete/1.0 (personal nutrition tracker)';

async function usda(query: string, key: string) {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', key);
  url.searchParams.set('query', query);
  url.searchParams.set('dataType', 'Foundation,SR Legacy');
  url.searchParams.set('pageSize', '8');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  const data = await res.json();
  return (data.foods || []).map((f: { description?: string; foodNutrients?: Nutrient[] }) => {
    const n = f.foodNutrients || [];
    return {
      name: String(f.description || '').toLowerCase().replace(/^./, (c) => c.toUpperCase()),
      per100: {
        calories: Math.round(pick(n, '208', '957', '958')),
        protein: r1(pick(n, '203')), carbs: r1(pick(n, '205')), fat: r1(pick(n, '204')),
        micros: {},
      },
      source: 'usda',
    };
  }).filter((f: { name: string }) => f.name);
}

async function off(query: string) {
  // Australian site first (local brands), then worldwide.
  for (const host of ['au.openfoodfacts.org', 'world.openfoodfacts.org']) {
    const url = `https://${host}/cgi/search.pl?action=process&search_terms=${encodeURIComponent(query)}&json=1&fields=product_name,nutriments&page_size=8`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const data = await res.json();
      const foods = (data.products || []).filter((p: { product_name?: string }) => p.product_name).map((p: { product_name: string; nutriments?: Record<string, number> }) => ({
        name: p.product_name,
        per100: {
          calories: Math.round(p.nutriments?.['energy-kcal_100g'] ?? 0),
          protein: r1(p.nutriments?.proteins_100g ?? 0),
          carbs: r1(p.nutriments?.carbohydrates_100g ?? 0),
          fat: r1(p.nutriments?.fat_100g ?? 0),
          micros: {},
        },
        source: 'off',
      }));
      if (foods.length) return foods;
    } catch { /* try the next host */ }
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const user = signedInUser(req.headers.get('Authorization'));
  if (!user) return json({ error: 'Authentication required' }, 401);
  if (!isOwner(user)) return json({ error: 'Not allowed' }, 403);

  let body: { query?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 80) : '';
  if (query.length < 2) return json({ foods: [] });

  const key = Deno.env.get('USDA_API_KEY');
  const [generic, branded] = await Promise.allSettled([key ? usda(query, key) : Promise.resolve([]), off(query)]);
  const a = generic.status === 'fulfilled' ? generic.value : [];
  const b = branded.status === 'fulfilled' ? branded.value : [];
  if (!a.length && !b.length && generic.status === 'rejected' && branded.status === 'rejected') {
    return json({ error: 'Food search is unavailable right now' }, 502);
  }
  return json({ foods: [...a.slice(0, 5), ...b] });
});

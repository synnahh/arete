// useFoodDb — loads the bundled food packs the first time food search is opened, then searches
// them in memory. Packs live in src/data/foods/: generic.json (USDA) and any branded*.json.
// They are separate lazy chunks, so the app starts without them.
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildIndex, searchIndex, dbFood } from '../domain/foodDb.js';

const loaders = import.meta.glob('../data/foods/*.json');
let cache = null;          // the built index, shared by every screen
let loading = null;

async function loadAll() {
  if (cache) return cache;
  if (!loading) {
    loading = Promise.all(Object.entries(loaders).map(async ([path, load]) => {
      const mod = await load();
      return buildIndex(/branded/i.test(path) ? 'branded' : 'generic', mod.default || mod);
    })).then(parts => { cache = parts.flat(); return cache; }).catch(() => { loading = null; return []; });
  }
  return loading;
}

/** { ready, search(query, limit) -> foods, count, branded } */
export function useFoodDb(enabled = true) {
  const [index, setIndex] = useState(cache);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!enabled || index) return;
    loadAll().then(i => { if (alive.current) setIndex(i); });
  }, [enabled, index]);

  return useMemo(() => ({
    ready: !!index,
    count: index?.length ?? 0,
    branded: index ? index.filter(e => e.kind === 'branded').length : 0,
    search: (query, limit = 12) => (index ? searchIndex(index, query, limit).map(dbFood) : []),
  }), [index]);
}

// useFoodLibrary — your own foods (collection `custom_foods`) and your favourites (one
// document, `food_favourites`). Rules: src/domain/customFoods.js.
import { useCallback, useMemo } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument } from '../supabase/useDocument.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toggleFavourite, isFavourite } from '../domain/customFoods.js';

const toast = (message, type = 'success') => window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type } }));

export function useFoodLibrary() {
  const foods = useCollection('custom_foods', STORAGE_KEYS.CUSTOM_FOODS);
  const doc = useDocument('food_favourites', 'valerie_food_favourites', { foods: [] });
  const favourites = useMemo(() => (Array.isArray(doc.data?.foods) ? doc.data.foods : []), [doc.data]);

  /** Star or unstar a food-like entry. Resolves to true when it is now a favourite. */
  const toggleFav = useCallback(async (entry) => {
    const { list, added, rejected } = toggleFavourite(favourites, entry);
    if (rejected) { toast('Only foods with a name and calories can be favourites.', 'error'); return false; }
    const ok = await doc.save({ foods: list });
    if (ok !== false) toast(added ? `★ ${entry.name} added to favourites` : `${entry.name} removed from favourites`);
    return added;
  }, [favourites, doc]);

  return {
    customFoods: foods.items || [],
    addCustomFood: foods.add, updateCustomFood: foods.update, removeCustomFood: foods.remove,
    favourites,
    isFav: (name) => isFavourite(favourites, name),
    toggleFav,
  };
}

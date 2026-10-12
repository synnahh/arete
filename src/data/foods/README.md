# Bundled food data

- `generic.json`: about 8,000 everyday foods from USDA FoodData Central (SR Legacy and Foundation Foods).
  Public domain (CC0). Row: `[name, kcal, protein, carbs, fat, fibre, sugar, sodiumMg, category, "1 cup=240|1 slice=28"]`.
- `branded-au.json`: about 10,900 packaged products sold in Australia, from the Open Food Facts export
  (13 Oct 2026). Row: `[name, brand, kcal, protein, carbs, fat, fibre, sugar, sodiumMg, servingLabel, servingGrams, barcode]`.
  Licence: Open Food Facts data is under the Open Database Licence (ODbL) with attribution: "Contains information from Open Food Facts, made available under the ODbL". The app shows that credit on the food search screen.
  Kept only: tagged Australia, has a name and a brand, complete calories/protein/carbs/fat per 100 g, numbers that add up. Dropped: everything else.

All numbers are per 100 g. To rebuild branded-au.json, download `en.openfoodfacts.org.products.csv.gz` from
`static.openfoodfacts.org/data/` and run the filter described above (see git history for the script's rules: HANDOVER-CODEX.md).

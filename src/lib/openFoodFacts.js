
export const searchUPC = async (upc) => {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${upc}.json`);
    const data = await response.json();

    if (data.status === 1 && data.product) {
      const p = data.product;
      const nutriments = p.nutriments || {};

      const servingSize = p.serving_size || "100g";
      
      let calories = nutriments["energy-kcal_serving"] || nutriments["energy-kcal_value"] || 0;
      let protein = nutriments["proteins_serving"] || nutriments["proteins_value"] || 0;
      let carbs = nutriments["carbohydrates_serving"] || nutriments["carbohydrates_value"] || 0;
      let fat = nutriments["fat_serving"] || nutriments["fat_value"] || 0;

      calories = Math.round(Number(calories) || 0);
      protein = Math.round(Number(protein) || 0);
      carbs = Math.round(Number(carbs) || 0);
      fat = Math.round(Number(fat) || 0);

      const imageUrl = p.image_url || p.image_front_url || null;

      return {
        name: p.product_name || "Unknown Product",
        calories: calories,
        protein: protein,
        carbs: carbs,
        fat: fat,
        category: "Snack",
        serving_size: servingSize,
        stockPhoto: imageUrl
      };
    }
    return null;
  } catch (err) {
    console.error("OpenFoodFacts Lookup Error:", err);
    return null;
  }
};

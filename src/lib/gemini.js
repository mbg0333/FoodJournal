import { GoogleGenerativeAI } from "@google/generative-ai";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export const analyzeFood = async (key, input, type) => {
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key.trim());
  const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {

        console.log(`[POST-ENTRY] AI HUNT: ${modelName} (Attempt ${attempt})...`);
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt = `Analyze this food input: "${input}". 
        SEARCH INTENT: Identify the exact branded product if possible.
        
        CRITICAL NUTRITION RULES:
        1. serving_size: Use the PACKAGE SUGGESTED SERVING (e.g., "1 oz", "approx 7 grapes", "1 pouch"). 
        2. DO NOT use "100g" unless it is explicitly a raw ingredient like flour/rice. 
        3. If vague, assume a "Single Normal Portion".
        4. For "Fruit Riot", use 1 oz (approx 45-50 kcals).

        RETURN JSON:
        { 
          "name": "Specific Product Name", 
          "calories": number, 
          "protein": number_float, 
          "carbs": number_float, 
          "fat": number_float, 
          "category": "Snack", 
          "serving_size": "string",
          "photoSearchQuery": "string_optimized_for_image_search"
        }`;

        const payload = (type === "photo") 
          ? [ { text: prompt }, { inlineData: { data: input, mimeType: "image/jpeg" } } ]
          : prompt;

        const result = await model.generateContent(payload);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
           console.log(`[POST-ENTRY] Success with ${modelName}!`);
           return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {

        if (e.message.includes("429") || e.message.includes("Quota")) {
           console.warn(`[POST-ENTRY] ${modelName} Rate Limited. Waiting 5s...`);
           await sleep(5000); 
           continue; 
        }
        if (e.message.includes("404")) {
           console.warn(`[POST-ENTRY] ${modelName} not found.`);
           break; 
        }
        console.warn(`[POST-ENTRY] Error: ${modelName}`, e.message);
      }
    }
  }
  return null;
};


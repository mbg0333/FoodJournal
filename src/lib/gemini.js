import { GoogleGenerativeAI } from "@google/generative-ai";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export const analyzeFood = async (key, input, type) => {
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key.trim());
  
  // 2.0-flash is smarter with brands. Use it first.
  const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"];
  
  for (const modelName of modelsToTry) {
    // 2 Retries per model for variability/429s
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(\[POST-ENTRY] AI HUNT: \ (Attempt \)...\);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const prompt = \Analyze this food input: "\". 
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
        }\;
        
        const payload = (type === 'photo') 
          ? [ { text: prompt }, { inlineData: { data: input, mimeType: "image/jpeg" } } ]
          : \\\;

        const result = await model.generateContent(payload);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/); // simple regex to find JSON blob
        
        if (jsonMatch) {
           console.log(\[POST-ENTRY] Success with \! ?\);
           return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        if (e.message.includes("429") || e.message.includes("Quota")) {
           console.warn(\[POST-ENTRY] \ Rate Limited. Waiting 5s...\);
           await sleep(5000); 
           continue; // Retry loop
        }
        if (e.message.includes("404")) {
           console.warn(\[POST-ENTRY] \ not found.\);
           break; // Don't retry this model, go to next
        }
        console.warn(\[POST-ENTRY] Error: \, e.message);
      }
    }
  }
  
  alert("AI Busy. Please wait 1 minute and try again.");
  return null;
};

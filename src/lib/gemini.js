import { GoogleGenerativeAI } from "@google/generative-ai";

export const analyzeFood = async (key, input, type) => {
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key.trim());
  
  // Updated list based on your specific key scanner results
  const modelsToTry = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];
  
  for (const modelName of modelsToTry) {
    try {
      // NEW LOG FORMAT TO IDENTIFY CACHE BUSTING
      console.log(`[VER 2.0] AI HUNT: Checking ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const prompt = `Analyze this food input. Identify name, calories, category (Breakfast, Lunch, Dinner, Snack). 
      Return ONLY valid JSON: { "name": "string", "calories": number, "category": "string", "restaurant": "string" }`;
      
      let result;
      if (type === 'photo') {
        result = await model.generateContent([
          { text: prompt },
          { inlineData: { data: input, mimeType: "image/jpeg" } }
        ]);
      } else {
        result = await model.generateContent(`${prompt}\nInput: ${input}`);
      }
      
      const response = await result.response;
      const text = response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
         console.log(`[VER 2.0] AI HUNT: Success with ${modelName}! ✅`);
         return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn(`[VER 2.0] AI HUNT: ${modelName} skipped.`, e.message);
    }
  }
  return null;
};

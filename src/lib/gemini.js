import { GoogleGenerativeAI } from "@google/generative-ai";

export const analyzeFood = async (key, input, type) => {
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key.trim());
  
  // We will try these in order until one works
  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];
  
  for (const modelName of modelsToTry) {
    try {
      console.log(`AI: Trying ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const prompt = `Analyze this food: ${type === 'text' ? input : 'the image'}. 
      Return ONLY JSON: { "name": "string", "calories": number, "category": "Breakfast|Lunch|Dinner|Snack", "restaurant": "" }`;
      
      let result;
      if (type === 'photo') {
        result = await model.generateContent([prompt, { inlineData: { data: input, mimeType: "image/jpeg" } }]);
      } else {
        result = await model.generateContent(prompt + (type === 'text' ? "\nInput: " + input : ""));
      }
      
      const response = await result.response;
      const text = response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        console.log(`AI: Success with ${modelName}! ✅`);
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn(`AI: ${modelName} failed, trying next...`);
      if (modelName === modelsToTry[modelsToTry.length - 1]) {
        console.error("AI: All models failed. Error:", e);
      }
    }
  }
  return null;
};

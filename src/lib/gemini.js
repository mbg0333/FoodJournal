import { GoogleGenerativeAI } from "@google/generative-ai";

export const analyzeFood = async (key, input, type) => {
  if (!key) return null;
  
  // Create the AI instance with the Stable v1 API forced
  const genAI = new GoogleGenerativeAI(key.trim());
  
  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];
  
  for (const modelName of modelsToTry) {
    try {
      console.log(`AI: Trying ${modelName} on stable v1...`);
      // Explicitly forcing v1 to avoid the v1beta 404 error seen in logs
      const model = genAI.getGenerativeModel({ 
        model: modelName 
      }, { apiVersion: "v1" });
      
      const prompt = `Analyze this food: ${type === 'text' ? input : 'the image'}. 
      Return ONLY JSON: { "name": "string", "calories": number, "category": "Breakfast|Lunch|Dinner|Snack", "restaurant": "" }`;
      
      let result;
      if (type === 'photo') {
        result = await model.generateContent([
          { text: prompt },
          { inlineData: { data: input, mimeType: "image/jpeg" } }
        ]);
      } else {
        result = await model.generateContent(prompt + "\nInput: " + input);
      }
      
      const response = await result.response;
      const text = response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        console.log(`AI: Success with ${modelName}! ✅`);
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn(`AI: ${modelName} failed...`, e.message);
      // Continue to next model
    }
  }
  
  console.error("AI: All models (v1) failed. Please check if Gemini API is enabled in your Google Cloud project.");
  return null;
};

import { GoogleGenerativeAI } from "@google/generative-ai";

export const analyzeFood = async (key, input, type) => {
  if (!key || key === "undefined" || key.length < 10) {
    console.error("Gemini Error: Invalid or Missing API Key");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(key.trim());
    // Using the absolute most stable model identifier
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let prompt = "";
    let parts = [];

    if (type === 'photo' || type === 'text' || type === 'voice') {
      prompt = `Analyze this food input (${type}). Identify the food, calories, and category (Breakfast, Lunch, Dinner, Snack). 
      If it's a photo, also try to identify the restaurant if a logo is present.
      Return ONLY JSON format: { "name": "string", "calories": number, "category": "string", "restaurant": "string" }`;
      
      if (type === 'photo') {
        parts = [prompt, { inlineData: { data: input, mimeType: "image/jpeg" } }];
      } else {
        parts = [`${prompt}\nInput: ${input}`];
      }
    }

    const resp = await model.generateContent(parts);
    const text = resp.response.text();
    // Use a more robust JSON extractor
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Gemini Error Details:", e);
    return null;
  }
};

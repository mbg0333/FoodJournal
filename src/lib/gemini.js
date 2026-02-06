import { GoogleGenerativeAI } from "@google/generative-ai";

export const analyzeFood = async (key, input, type) => {
  if (!key) {
    console.error("Gemini Error: No API Key provided");
    return null;
  }

  const genAI = new GoogleGenerativeAI(key.trim());
  // Using gemini-1.5-flash as it is the most reliable for this use case
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
  } else if (type === 'shopping' || type === 'shopping-photo') {
    prompt = `Analyze this shopping item/photo. Provide higher-protein/lower-carb alternatives. 
    Return ONLY JSON format: { "name": "string", "suggestions": [ "string" ] }`;
    if (type === 'shopping-photo') {
      parts = [prompt, { inlineData: { data: input, mimeType: "image/jpeg" } }];
    } else {
      parts = [`${prompt}\nInput: ${input}`];
    }
  }

  try {
    const resp = await model.generateContent(parts);
    const text = resp.response.text();
    // Clean up markdown formatting if Gemini includes it
    const cleanText = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Gemini Error Details:", e);
    return null;
  }
};

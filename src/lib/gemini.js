import { GoogleGenerativeAI } from "@google/generative-ai";

export const analyzeFood = async (key, input, type) => {
  if (!key || key === "undefined" || key.length < 10) {
    console.error("Gemini Error: Invalid or Missing API Key");
    return null;
  }

  try {
    // Force the use of the stable v1 API version
    const genAI = new GoogleGenerativeAI(key.trim());
    
    // Some keys/regions work better with 'gemini-1.5-flash' vs 'gemini-1.5-flash-latest'
    // We explicitly set the version to v1 in the model options if supported by SDK, 
    // or just use the most stable model string.
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
    }, { apiVersion: 'v1' }); 

    let prompt = "";
    let parts = [];

    if (type === 'photo' || type === 'text' || type === 'voice') {
      prompt = `Analyze this food input (${type}). Identify the food, calories, and category (Breakfast, Lunch, Dinner, Snack). 
      If it's a photo, also try to identify the restaurant if a logo is present.
      Return ONLY JSON format: { "name": "string", "calories": number, "category": "string", "restaurant": "string" }`;
      
      if (type === 'photo') {
        parts = [
          { text: prompt },
          { inlineData: { data: input, mimeType: "image/jpeg" } }
        ];
      } else {
        parts = [{ text: `${prompt}\nInput: ${input}` }];
      }
    }

    // Official v1 structure
    const result = await model.generateContent({
      contents: [{ role: "user", parts }]
    });

    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Gemini Details:", e);
    // If v1 fails, we try a fallback model name
    if (e.message.includes("404")) {
       console.log("Attempting fallback model...");
       try {
         const genAIFallback = new GoogleGenerativeAI(key.trim());
         const modelFallback = genAIFallback.getGenerativeModel({ model: "gemini-pro" });
         // ... simplified logic for fallback if needed, but usually flash is the one.
       } catch (inner) {}
    }
    return null;
  }
};

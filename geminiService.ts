
import { GoogleGenAI, Type } from "@google/genai";
import { FoodAnalysis } from './types';

export const analyzeFoodImage = async (base64Image: string): Promise<FoodAnalysis> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });
  
  // Use gemini-3-flash-preview for fast and efficient food analysis
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
        {
          text: `Analyze this image. Identify the food items. Return a JSON object with fields: foodName (string), calories (integer), protein (string, e.g., '20g'), carbs (string), fat (string), explanation (short sentence). Do not use Markdown formatting in the response, just raw JSON.`,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          foodName: { type: Type.STRING },
          calories: { type: Type.INTEGER },
          protein: { type: Type.STRING },
          carbs: { type: Type.STRING },
          fat: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ["foodName", "calories", "protein", "carbs", "fat", "explanation"],
      },
    },
  });

  try {
    const data = JSON.parse(response.text || '{}');
    return data as FoodAnalysis;
  } catch (err) {
    console.error("Failed to parse Gemini response:", err);
    throw new Error("Could not interpret analysis results.");
  }
};

export const getDailyAdvice = async (summary: string, goal: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey! });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on today's intake summary: "${summary}". The user's goal is: ${goal}. Provide brief, friendly advice (2 sentences) on how they did and one improvement tip.`,
  });

  return response.text || "Keep up the healthy eating!";
};

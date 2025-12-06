import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

// Initialize the client with the API Key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Creates a new chat session with the Gemini 2.5 Flash model.
 */
export const createChatSession = (): Chat => {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: "You are a helpful, witty, and precise AI assistant powered by Google's Gemini 2.5 Flash model. Format your responses with Markdown.",
    },
  });
};

/**
 * Generates an image using the Gemini 2.5 Flash Image model (Nano Banana).
 * Note: This model returns the image data inline within the response parts.
 */
export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: prompt }
        ]
      },
      // Note: responseMimeType is not supported for nano banana series models
    });

    // Iterate through parts to find the inline image data
    const parts = response.candidates?.[0]?.content?.parts;
    
    if (!parts) {
      throw new Error("No content generated");
    }

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        const base64EncodeString = part.inlineData.data;
        // Assuming PNG as default or checking mimeType if available, usually image/png
        const mime = part.inlineData.mimeType || 'image/png';
        return `data:${mime};base64,${base64EncodeString}`;
      }
    }

    throw new Error("No image data found in response");

  } catch (error) {
    console.error("Image generation error:", error);
    throw error;
  }
};

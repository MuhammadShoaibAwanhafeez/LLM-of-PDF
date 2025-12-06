import { GoogleGenAI, GenerateContentResponse, Content, Type } from "@google/genai";
import { IndexItem, QuizQuestion } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing in process.env");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * A utility function to wrap an async operation with an exponential backoff retry mechanism.
 */
const withRetry = async <T>(fn: () => Promise<T>, retries = 3, initialDelay = 1000): Promise<T> => {
    let attempt = 0;
    while (attempt < retries) {
        try {
            return await fn();
        } catch (error) {
            const errorMessage = String(error);
            if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
                attempt++;
                if (attempt >= retries) {
                    console.error("API rate limit exceeded after multiple retries.", error);
                    throw error;
                }
                const delay = initialDelay * Math.pow(2, attempt - 1);
                const jitter = delay * 0.2 * Math.random(); 
                const waitTime = delay + jitter;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                throw error;
            }
        }
    }
    throw new Error("Retry logic failed unexpectedly.");
};

/**
 * Helper to clean JSON string from Markdown formatting.
 */
function cleanJsonString(str: string): string {
    // Remove markdown code blocks (```json ... ```)
    let cleaned = str.replace(/```json/g, '').replace(/```/g, '');
    
    // Attempt to isolate the array if there's preamble text
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
        cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }
    
    return cleaned.trim();
}

/**
 * Helper to safely parse JSON, attempting to repair truncated responses.
 */
function safeJsonParse<T>(jsonString: string, fallbackValue: T): T {
    const cleanedString = cleanJsonString(jsonString);
    
    try {
        return JSON.parse(cleanedString);
    } catch (e) {
        // Attempt repair for truncated JSON
        console.warn("JSON parse failed, attempting repair on:", cleanedString.substring(0, 100) + "...");
        
        const trimmed = cleanedString.trim();
        const lastBrace = trimmed.lastIndexOf('}');
        const lastBracket = trimmed.lastIndexOf(']');

        // Determine if we are likely inside an object or an array at the end
        // For IndexItem[], we expect it to end with ']'
        // If truncated, it might end anywhere.
        
        // Simple repair strategy: try to close open structures
        let openBrackets = 0; // [
        let openBraces = 0;   // {
        
        for (const char of trimmed) {
            if (char === '[') openBrackets++;
            else if (char === ']') openBrackets--;
            else if (char === '{') openBraces++;
            else if (char === '}') openBraces--;
        }
        
        let repaired = trimmed;
        while (openBraces > 0) {
            repaired += '}';
            openBraces--;
        }
        while (openBrackets > 0) {
            repaired += ']';
            openBrackets--;
        }
        
        try {
            const result = JSON.parse(repaired);
            if (Array.isArray(result)) {
                return result as T;
            }
        } catch (e2) {
             console.warn("Failed to repair JSON:", e2);
        }
        return fallbackValue;
    }
}

export const getInitialHistory = (pdfText: string): Content[] => {
  const initialPrompt = `You are an expert AI Professor. Your task is to explain the content of the provided document with **Textbook Quality** formatting.

**Strict HTML Formatting Rules (NO Markdown):**
1.  **Headings:** Use <h3> or <h4> tags for main topics. Ensure they stand out.
2.  **Paragraphs:** Use <p> tags for content. Keep paragraphs concise.
3.  **Lists:** Use <ul> for bullet points and <ol> for numbered lists. Ensure <li> items are clearly separated.
4.  **Citations:** 
    *   When quoting text from the document, place it in a distinct container.
    *   **Do NOT** use labels like "Original Text" or "Matn". Just display the quote.
    *   **CRITICAL:** If the quote is English, it MUST be Left-Aligned (ltr). If Urdu, Right-Aligned (rtl).
    *   Add a reference footer below the quote: 
        <div style="font-size: 11px; color: #6b7280; font-style: italic; text-align: right;">📍 Ref: [Heading/Topic] | Page [Number]</div>
    *   Use the '--- Page XStart ---' markers in the document text to determine the Page Number.

**Urdu Formatting:**
For any Urdu text, ensure generous line spacing and clear font rendering to support Nastealiq style readability.

**Tone:** Professional, Educational, Clean, and Easy to Read.

Your knowledge is strictly limited to the document provided below. Answer based ONLY on the text from the document.

Here is the document:
---
${pdfText}`;

  return [
      {
        role: "user",
        parts: [{ text: initialPrompt }],
      },
      {
        role: "model",
        parts: [{ text: "I am ready to help you learn from this document with clear, textbook-style explanations and accurate page references." }],
      },
    ];
};

export async function* sendMessageStream(history: Content[], message: string) {
  const model = 'gemini-2.5-flash';
  const ai = getAiClient();
  const contents: Content[] = [...history, { role: 'user', parts: [{ text: message }] }];

  try {
    const response = await ai.models.generateContentStream({
        model: model,
        contents: contents,
        config: {
            // Re-enabled thinking for chat to ensure high quality answers
            thinkingConfig: { thinkingBudget: 1024 }
        }
    });

    for await (const chunk of response) {
        yield chunk.text;
    }
  } catch (error) {
      console.error("Error in sendMessageStream", error);
      yield "Sorry, I encountered an error. Please check your connection.";
  }
}

export const generateDocumentIndex = async (pdfText: string): Promise<IndexItem[]> => {
    const model = 'gemini-2.5-flash';
    const ai = getAiClient();

    const systemInstruction = `Act as a professional document indexer. Your task is to generate a **Comprehensive, Complete, and Exhaustive** Table of Contents (TOC) for the provided document.

    **CRITICAL INSTRUCTIONS:**
    1.  **Analyze Structure:** Iterate through the document. Identify Units, Chapters, Lessons, and Topics.
    2.  **Hierarchy:**
        *   **Unit:** The top-level grouping (e.g., "Unit 1", "Chapter 1", or "Part A"). If none, use "Main Content".
        *   **Lessons:** The major sections within a unit.
        *   **Topics:** The detailed sub-sections under a lesson.
    3.  **JSON Format ONLY:** Return the result **strictly** as a JSON array. Do not wrap in markdown code blocks.
    
    **Output Schema:**
    [
      {
        "unit": "Unit Name",
        "lessons": [
          {
            "title": "Lesson Title",
            "topics": [
                "1.1 First Topic",
                "1.2 Second Topic"
            ]
          }
        ]
      }
    ]
    `;

    try {
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: model,
                contents: [
                    { role: 'user', parts: [{ text: systemInstruction }] },
                    { role: 'user', parts: [{ text: `Here is the document text to index:\n---\n${pdfText}` }] }
                ],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                unit: { type: Type.STRING },
                                lessons: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            title: { type: Type.STRING },
                                            topics: { type: Type.ARRAY, items: { type: Type.STRING } }
                                        },
                                        required: ['title', 'topics']
                                    }
                                }
                            },
                            required: ['unit', 'lessons']
                        }
                    },
                    // Removed thinkingConfig for index to improve reliability/speed for this structural task
                    // and avoid potential token limit conflicts.
                }
            });
        });
        
        const jsonText = response.text;
        if (!jsonText) return [];
        
        return safeJsonParse(jsonText, [{ unit: "Document Overview (Fallback)", lessons: [{ title: "Full Document Content", topics: ["The index could not be fully generated. You can still chat with the full document."] }] }]);

    } catch (error) {
        console.error("Error generating index:", error);
        return [{ unit: "Document Overview", lessons: [{ title: "Full Document Content", topics: ["Index generation failed. You can still chat with the full document."] }] }];
    }
};

export const generateQuizQuestionsFromText = async (pdfText: string, prompt: string): Promise<QuizQuestion[]> => {
    const model = 'gemini-2.5-flash';
    const ai = getAiClient();

    try {
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: model,
                contents: [{ role: 'user', parts: [{ text: pdfText }] }, { role: 'user', parts: [{ text: prompt }] }],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                answer: { type: Type.STRING }
                            },
                            required: ['question', 'options', 'answer']
                        }
                    },
                    thinkingConfig: { thinkingBudget: 2048 }
                }
            });
        });

        const jsonText = response.text;
        if (!jsonText) return [];
        return safeJsonParse(jsonText, []);

    } catch (error) {
        console.error("Error generating quiz questions:", error);
        return [];
    }
};

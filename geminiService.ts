import { GoogleGenAI, GenerateContentResponse, Content, Type } from "@google/genai";
import { IndexItem, QuizQuestion } from '../types'; // Add QuizQuestion

/**
 * Initializes and returns a new GoogleGenAI client instance using a provided API key.
 * @param apiKey The user-provided Gemini API key.
 * @returns A GoogleGenAI instance.
 */
const getAiClient = (apiKey: string) => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please provide a valid API key in the settings.");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * A utility function to wrap an async operation with an exponential backoff retry mechanism.
 * This is primarily used to handle API rate-limiting errors (429).
 * @param fn The async function to execute.
 * @param retries The maximum number of retry attempts.
 * @param initialDelay The initial delay in milliseconds before the first retry.
 * @returns A promise that resolves with the result of the function if successful.
 */
const withRetry = async <T>(fn: () => Promise<T>, retries = 3, initialDelay = 1000): Promise<T> => {
    let attempt = 0;
    while (attempt < retries) {
        try {
            return await fn();
        } catch (error) {
            const errorMessage = String(error);
            // Check for rate limit error (429) or RESOURCE_EXHAUSTED
            if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
                attempt++;
                if (attempt >= retries) {
                    console.error("API rate limit exceeded after multiple retries.", error);
                    throw error; // Re-throw the original error after all retries fail
                }
                // Exponential backoff with jitter
                const delay = initialDelay * Math.pow(2, attempt - 1);
                const jitter = delay * 0.2 * Math.random(); // Add up to 20% jitter
                const waitTime = delay + jitter;
                console.log(`Rate limit hit. Retrying in ${waitTime.toFixed(0)}ms... (Attempt ${attempt}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                // Not a retryable error, throw immediately
                throw error;
            }
        }
    }
    // This part should be unreachable if logic is correct, but satisfies TypeScript's need for a return path.
    throw new Error("Retry logic failed unexpectedly.");
};


/**
 * Creates the initial history for a Gemini chat session with the context of a PDF document.
 * @param pdfText The extracted text from the PDF file.
 * @returns An array of initial Content objects for the chat history.
 */
export const getInitialHistory = (pdfText: string): Content[] => {
  const initialPrompt = `You are an expert AI Professor. Your knowledge is strictly limited to the document provided below. Answer the user's questions based ONLY on the text from the document. If the answer is not in the text, you must say "I cannot find the answer in the provided document." Do not use any outside knowledge.

When it improves clarity, format your response using rich HTML. For example, you can use <strong> for bold text, <em> for italics, and <ul> with <li> for lists.

Here is the document I want to discuss:
---
${pdfText}`;

  return [
      {
        role: "user",
        parts: [{ text: initialPrompt }],
      },
      {
        role: "model",
        parts: [{ text: "What do you want to discover ?" }],
      },
    ];
};

/**
 * Sends a message to Gemini using the generateContent method with conversation history.
 * @param history The conversation history.
 * @param message The user's new message.
 * @param apiKey The user's Gemini API key.
 * @returns The model's response text.
 */
export const sendMessage = async (history: Content[], message: string, apiKey: string): Promise<string> => {
  const model = 'gemini-2.5-flash';
  
  try {
    const ai = getAiClient(apiKey);
    const contents: Content[] = [...history, { role: 'user', parts: [{ text: message }] }];
    
    const response = await withRetry(async () => {
        return await ai.models.generateContent({
            model: model,
            contents: contents,
        });
    });

    return response.text;
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    const errorMessage = String(error);
     if (errorMessage.includes('API key not valid')) {
        return "<strong>Error:</strong> The provided API key is not valid. Please check your key in the settings and try again.";
    }
    if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('429')) {
        return `<strong>Error:</strong> API rate limit exceeded.
                <br>Please <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">check your plan and billing details</a> or try again in a few moments.
                <br>For more info, see the <a href="https://ai.google.dev/gemini-api/docs/rate-limits" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">rate limits documentation</a>.`;
    }
    return "Sorry, I encountered an error trying to respond. Please check your connection or API key and try again.";
  }
};

/**
 * Generates a structured index or table of contents from the document text.
 * @param pdfText The full text of the PDF document.
 * @param apiKey The user's Gemini API key.
 * @returns A promise that resolves to an array of index items.
 */
export const generatePdfIndex = async (pdfText: string, apiKey: string): Promise<IndexItem[]> => {
    const model = 'gemini-2.5-flash';
    const ai = getAiClient(apiKey);

    const prompt = `Analyze the following document text and generate a structured table of contents or index.
    Identify the main chapters, sections, or topics, and list their key subheadings.
    Provide the output as a JSON array of objects, where each object has a "title" and a "subheadings" array.
    For example: [{ "title": "Chapter 1: The Beginning", "subheadings": ["1.1 Introduction", "1.2 Core Concepts"] }]
    If the document has no clear structure, do your best to create a logical topic-based index.

    Document Text:
    ---
    ${pdfText}`

    try {
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: model,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                subheadings: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING }
                                }
                            },
                            required: ['title', 'subheadings']
                        }
                    }
                }
            });
        });
        
        const jsonText = response.text.trim();
        if (!jsonText) {
            console.warn("Received empty response from Gemini for index generation.");
            return [];
        }
        const indexData = JSON.parse(jsonText);
        return indexData;

    } catch (error) {
        console.error("Error generating PDF index:", error);
        const errorMessage = String(error);
        if (errorMessage.includes('API key not valid')) {
             throw new Error("The provided API key is not valid. Please check your key in the settings.");
        }
        if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('429')) {
            throw new Error("API rate limit exceeded. Please check your billing details or try again in a few moments.");
        }
        if (error instanceof SyntaxError) { // Catches JSON.parse errors
            throw new Error("The AI returned an invalid format for the index. Please try again.");
        }
        throw new Error("An unexpected error occurred while generating the document index.");
    }
};

/**
 * Generates multiple-choice quiz questions from the document text based on a prompt.
 * @param pdfText The full text of the PDF document, used as context.
 * @param prompt The prompt for generating MCQs.
 * @param apiKey The user's Gemini API key.
 * @returns A promise that resolves to an array of QuizQuestion.
 */
export const generateQuizQuestions = async (pdfText: string, prompt: string, apiKey: string): Promise<QuizQuestion[]> => {
    const model = 'gemini-2.5-flash';
    const ai = getAiClient(apiKey);

    try {
        const response = await withRetry(async () => {
            // The content should include the PDF text first for context, then the specific prompt.
            // This is effectively mimicking the initial history setup for context-aware generation.
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
                    }
                }
            });
        });

        const jsonText = response.text.trim();
        if (!jsonText) {
            console.warn("Received empty response from Gemini for quiz generation.");
            return [];
        }
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error generating quiz questions:", error);
        const errorMessage = String(error);
        if (errorMessage.includes('API key not valid')) {
             throw new Error("The provided API key is not valid. Please check your key in the settings.");
        }
        if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('429')) {
            throw new Error("API rate limit exceeded. Please check your billing details or try again in a few moments.");
        }
        if (error instanceof SyntaxError) { // Catches JSON.parse errors
            throw new Error("The AI returned an invalid format for the quiz questions. Please try again.");
        }
        throw new Error("An unexpected error occurred while generating quiz questions.");
    }
};
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';

// Configure the workerSrc for pdf.js to ensure it runs in a separate thread.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

interface ExtractionResult {
  text: string;
  numPages?: number;
}

/**
 * Extracts all text content from a given PDF file.
 * @param file The PDF file to process.
 * @returns A promise that resolves to an object containing the full text content and the number of pages.
 */
const extractTextFromPdfFile = async (file: File): Promise<ExtractionResult> => {
  const arrayBuffer = await file.arrayBuffer();
  // The worker is used automatically since workerSrc is configured globally.
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  // Create an array of promises, one for each page's text extraction.
  const pagePromises = Array.from({ length: numPages }, async (_, i) => {
    const page = await pdf.getPage(i + 1);
    const textContent = await page.getTextContent();
    // Join the text items for the current page.
    const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(" ");
    
    // Inject Page Marker clearly for the AI to pick up
    return `--- Page ${i + 1}Start ---\n${pageText}\n--- Page ${i + 1}End ---`;
  });

  // Wait for all pages to be processed concurrently.
  const pageTexts = await Promise.all(pagePromises);

  // Join the text from all pages into a single string.
  const text = pageTexts.join("\n\n");
  
  return { text, numPages };
};

/**
 * Extracts text from a .txt file.
 * @param file The TXT file.
 * @returns A promise resolving to the text content.
 */
const extractTextFromTxtFile = (file: File): Promise<ExtractionResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve({ text: event.target?.result as string });
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsText(file);
  });
};

/**
 * Extracts text from a .docx file using mammoth.js.
 * @param file The DOCX file.
 * @returns A promise resolving to the text content.
 */
const extractTextFromDocxFile = async (file: File): Promise<ExtractionResult> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: result.value };
};

/**
 * Extracts text from a supported file (PDF, DOCX, TXT).
 * @param file The file to process.
 * @returns A promise that resolves to an object with text and optional numPages.
 */
export const extractTextFromFile = async (file: File): Promise<ExtractionResult> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    switch (extension) {
        case 'pdf':
            return extractTextFromPdfFile(file);
        case 'docx':
            return extractTextFromDocxFile(file);
        case 'txt':
            return extractTextFromTxtFile(file);
        default:
            // This is a fallback for mime types
            if (file.type === 'application/pdf') return extractTextFromPdfFile(file);
            if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return extractTextFromDocxFile(file);
            if (file.type === 'text/plain') return extractTextFromTxtFile(file);
            
            throw new Error('Unsupported file type.');
    }
};
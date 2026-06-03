import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../../config/logger.js';
import { config } from '../../config/env.js';

let aiInstance = null;

// Lazy initialization of Google Gemini SDK
function getGeminiClient() {
  if (!config.llm.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not defined in your environment configurations.');
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenerativeAI(config.llm.geminiApiKey);
  }
  return aiInstance;
}

export async function validateWithGemini(articleTitle, sourceName, articleContent) {
  try {
    const ai = getGeminiClient();
    
    // Using gemini-2.5-flash as it is extremely cost-effective and ultra-fast for classification
    const model = ai.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const prompt = `
You are an expert AI news validator and summarizer. Analyze this news article to see if it is high-quality, actual AI industry/technology news, and output a structured JSON response.

ARTICLE INFORMATION:
- Source: ${sourceName}
- Title: ${articleTitle}
- Content Snippet: ${articleContent}

CRITERIA:
- isValid: Boolean. True only if it is real, direct AI news (releases, research papers, major GPU hardware events, or AI model announcements). Set False for speculative finance, spam, duplicate content, or generic tech news.
- relevanceScore: Number (0 to 100). Rate the significance (e.g., major model releases are 90+, small bugfixes are 20-30).
- summary: A clear, concise 2-sentence summary of the news.
- keyTakeaways: An array of exactly 3 bullet points showing key impacts or tech specifications.
- category: A single string categorizing the news (e.g. 'LLM Release', 'Hardware', 'Safety & Regulation', 'Corporate', 'Research').

Return ONLY a JSON object matching this schema:
{
  "isValid": boolean,
  "relevanceScore": number,
  "summary": "string",
  "keyTakeaways": ["string", "string", "string"],
  "category": "string"
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    logger.debug('Gemini raw response: %s', responseText);
    const parsedData = JSON.parse(responseText.trim());
    return parsedData;

  } catch (error) {
    logger.error('Gemini API execution error: %s', error.message);
    throw error;
  }
}

import OpenAI from 'openai';
import logger from '../../config/logger.js';
import { config } from '../../config/env.js';

let openaiInstance = null;

function getOpenAIClient() {
  if (!config.llm.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not defined in your environment configurations.');
  }
  if (!openaiInstance) {
    openaiInstance = new OpenAI({ apiKey: config.llm.openaiApiKey });
  }
  return openaiInstance;
}

export async function validateWithOpenAI(articleTitle, sourceName, articleContent) {
  try {
    const openai = getOpenAIClient();
    
    // Using gpt-4o-mini as it is fast, highly intelligent, and cost-effective
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an AI news auditor. Your job is to classify if news is valid AI news, score its significance, and return structured JSON. The output must strictly follow this JSON structure: { "isValid": boolean, "relevanceScore": number, "summary": "string", "keyTakeaways": ["string", "string", "string"], "category": "string" }'
        },
        {
          role: 'user',
          content: `Evaluate the following content:\n\nSource: ${sourceName}\nTitle: ${articleTitle}\nContent: ${articleContent}`
        }
      ]
    });

    const responseText = response.choices[0].message.content;
    logger.debug('OpenAI raw response: %s', responseText);
    const parsedData = JSON.parse(responseText.trim());
    return parsedData;

  } catch (error) {
    logger.error('OpenAI API execution error: %s', error.message);
    throw error;
  }
}

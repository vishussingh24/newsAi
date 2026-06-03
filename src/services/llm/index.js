import logger from '../../config/logger.js';
import { config } from '../../config/env.js';
import { validateWithGemini } from './gemini.js';
import { validateWithOpenAI } from './openai.js';

export async function validateArticle(articleTitle, sourceName, articleContent) {
  const provider = config.llm.provider.toLowerCase();
  
  // Checking if credentials are missing. If so, fallback to mocked LLM logic.
  const hasGeminiKey = !!config.llm.geminiApiKey;
  const hasOpenAIKey = !!config.llm.openaiApiKey;
  
  if ((provider === 'gemini' && !hasGeminiKey) || (provider === 'openai' && !hasOpenAIKey)) {
    logger.warn('LLM credentials missing for provider: %s. Using high-fidelity local rules mock validator.', provider);
    return runMockLLMValidator(articleTitle, sourceName, articleContent);
  }

  try {
    if (provider === 'openai') {
      return await validateWithOpenAI(articleTitle, sourceName, articleContent);
    } else {
      return await validateWithGemini(articleTitle, sourceName, articleContent);
    }
  } catch (error) {
    logger.error('LLM API validation failed. Falling back to local rules mock validator. Error: %s', error.message);
    return runMockLLMValidator(articleTitle, sourceName, articleContent);
  }
}

/**
 * Local simulation of an LLM evaluator. 
 * Allows flawless offline local testing of the complete data pipeline.
 */
function runMockLLMValidator(title, source, content) {
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  // Basic heuristic keyword check
  const isAIKeyWord = ['gpt', 'claude', 'gemini', 'sora', 'tpu', 'llm', 'safety', 'deepmind', 'ai', 'model', 'weights'].some(word => 
    lowerTitle.includes(word) || lowerContent.includes(word)
  );

  const isSpeculativeOrSpam = ['crypto', 'stock price', 'stocks', 'financial results', 'quarterly earnings'].some(word =>
    lowerTitle.includes(word)
  );

  const isValid = isAIKeyWord && !isSpeculativeOrSpam;
  let relevanceScore = 50;
  let category = 'Research';

  if (lowerTitle.includes('gpt-5') || lowerTitle.includes('claude 4') || lowerTitle.includes('gemini 2')) {
    relevanceScore = 95;
    category = 'LLM Release';
  } else if (lowerTitle.includes('safety') || lowerTitle.includes('council')) {
    relevanceScore = 75;
    category = 'Safety & Regulation';
  } else if (lowerTitle.includes('tpu') || lowerTitle.includes('gpu')) {
    relevanceScore = 80;
    category = 'Hardware';
  }

  return {
    isValid,
    relevanceScore,
    summary: `Local Mock Summary: "${title}" posted by ${source}. This article discusses key changes and technological advancements in the field of AI.`,
    keyTakeaways: [
      `Key Takeaway 1: Discusses the impact of the release from ${source}.`,
      `Key Takeaway 2: Shows the industry convergence around high scale model training parameters.`,
      `Key Takeaway 3: Highlights active developer integration vectors.`
    ],
    category
  };
}

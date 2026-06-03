import logger from '../config/logger.js';
import { queries } from '../database/queries.js';
import { validateArticle } from '../services/llm/index.js';

let isRunning = false;

export async function executeValidatorJob() {
  if (isRunning) {
    logger.warn('LLM validation job is already active. Skipping duplicate run.');
    return;
  }

  isRunning = true;
  logger.info('[SCHEDULER] Triggering LLM Validation job...');

  try {
    const pendingArticles = await queries.getPendingRawArticles(20); // Process in batches of 20
    
    if (pendingArticles.length === 0) {
      logger.info('[SCHEDULER] No pending raw articles found to validate.');
      return;
    }

    logger.info('[SCHEDULER] Found %d raw articles to validate.', pendingArticles.length);
    let successCount = 0;

    for (const article of pendingArticles) {
      try {
        logger.info('Validating raw article ID %d: "%s"', article.id, article.title);
        
        // Execute LLM evaluation
        const result = await validateArticle(
          article.title, 
          article.source_name, 
          article.raw_content
        );

        // Store validation log
        await queries.insertProcessedArticle(
          article.id,
          result.isValid,
          result.relevanceScore,
          result.summary,
          result.keyTakeaways,
          result.category
        );

        // Mark raw article as processed
        await queries.updateRawArticleStatus(article.id, 'processed');
        successCount++;

        logger.info('Article ID %d classified. IsValid: %s, Score: %d', article.id, result.isValid, result.relevanceScore);

      } catch (error) {
        logger.error('Failed to validate article ID %d: %s', article.id, error.message);
        await queries.updateRawArticleStatus(article.id, 'failed');
      }
    }

    logger.info('[SCHEDULER] LLM validation job cycle complete. Evaluated %d/%d articles.', successCount, pendingArticles.length);

  } catch (error) {
    logger.error('[SCHEDULER] LLM Validation job cycle failed: %s', error.message);
  } finally {
    isRunning = false;
  }
}
